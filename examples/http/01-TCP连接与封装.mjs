/**
 * 第 01 章配套示例 · TCP 连接与"封装/解封装"
 *
 * 用 node:net 亲手建一条 TCP 连接，亲眼看到：
 *  1. 端口是什么（本地端口 + 远端端口）
 *  2. 你发出去的"文本"，在传输层只是一串字节（Buffer）
 *  3. 发送方"封装"、接收方"解封装"——应用层只管表达意图，TCP 负责可靠送达
 *
 * 运行：node 01-TCP连接与封装.mjs
 * 进程会自然退出（服务端 close 之后退出），不会挂起。
 */

import net from 'node:net';

// 一台机器的端口是一个 0~65535 的整数，用来区分"这条连接是给谁用的"。
// 服务器监听端口，客户端"发起连接"时会被内核分配一个随机的本地端口。
const server = net.createServer((socket) => {
  console.log('[server] 收到一条 TCP 连接（三次握手已完成，见第 02 章）');
  console.log('[server]   远端地址 ' + socket.remoteAddress + ':' + socket.remotePort);
  console.log('[server]   本地地址 ' + socket.localAddress + ':' + socket.localPort);

  // 数据是一块一块"流"进来的，可能一次到齐，也可能分好几次。
  socket.on('data', (data) => {
    console.log('[server] 收到原始字节（Buffer，这就是"封装"在传输层的样子）:');
    console.log('[server]   ' + data.toString('hex'));
    console.log('[server] 解封装成文本后（这就是应用层想要的东西）:');
    console.log('[server]   ' + JSON.stringify(data.toString('utf8')));

    // 服务器回一段字节。写进 socket 之后，TCP 会负责把它可靠、有序地送到对面。
    socket.write('HTTP/1.1 200 OK\r\n\r\n你好，这是 TCP 连接里的一段字节流');
    socket.end(); // 优雅关闭：发一个 FIN（第 02 章讲）
  });

  socket.on('end', () => {
    console.log('[server] 收到对端的 FIN，对方不再发送数据了');
  });
});

// listen(0) 表示"让内核随便分一个空闲端口给我"，避免端口冲突。
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  console.log('[server] 监听在 127.0.0.1:' + port + '（0 表示随机分配）');
  console.log('');

  const client = net.createConnection({ host: '127.0.0.1', port }, () => {
    console.log('[client] connect 成功，连接已建立');
    console.log('[client]   本地端口（内核帮我分配的）: ' + client.localPort);
    console.log('[client]   目标端口（服务器的）: ' + client.remotePort);
    console.log('');

    // 应用层想表达的"请求"，对 TCP 来说只是要可靠送达的一串字节。
    // 这里模仿浏览器发一个最简 HTTP 请求文本（第 04 章会正式讲报文结构）。
    const message = 'GET / HTTP/1.1\r\nHost: example.com\r\n\r\n';
    console.log('[client] 准备发送（应用层看到的文本）:');
    console.log('[client]   ' + JSON.stringify(message));
    console.log('[client] 发送……（交给 TCP，之后的事 TCP 负责）');
    client.write(message);
  });

  client.on('data', (data) => {
    console.log('');
    console.log('[client] 收到服务器回应的字节流:');
    console.log('[client]   ' + data.toString('utf8'));
    client.end();
  });

  client.on('close', () => {
    console.log('[client] 连接关闭');
    server.close(() => {
      console.log('[server] 已关闭，进程自然退出');
    });
  });

  client.on('error', (err) => {
    console.log('[client] 出错:', err.code, err.message);
  });
});
