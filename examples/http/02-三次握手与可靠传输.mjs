/**
 * 第 02 章配套示例 · TCP 三次握手、有序字节流与四次挥手
 *
 * 用 node:net 观察：
 *  1. 三次握手：是内核自动完成的，应用层"看到"的标志就是 connect 成功
 *  2. 可靠传输：TCP 保证字节有序、不丢、不重复——所以服务端分 3 段写，
 *     客户端按顺序拼起来，就是一个完整的句子
 *  3. 四次挥手：FIN 是"半关闭"，发完 FIN 还能继续收数据，直到对端也回 FIN
 *
 * 运行：node 02-三次握手与可靠传输.mjs
 */

import net from 'node:net';

const server = net.createServer((socket) => {
  // 到这里时，三次握手已经由操作系统内核完成了。
  // 应用层只能"看到"这个回调，看不到 SYN/ACK 报文本身（它们发生在内核里）。
  console.log('[server] connect 事件 = 三次握手已完成');
  console.log('');

  socket.on('data', (d) => {
    console.log('[server] 收到一段字节:', JSON.stringify(d.toString('utf8')));
    console.log('[server] 分 3 次 write 回应（注意：TCP 是字节流，没有消息边界，');
    console.log('[server]   3 次 write 到接收端可能被合并成 1 次 data 读到）……');
    console.log('');

    socket.write('第一段：你好，');
    socket.write('第二段：这是被 TCP 保证');
    socket.write('第三段：有序送达的字节流。');
    // 注意：这里故意不 end，等客户端先发 FIN，演示"半关闭"
  });

  socket.on('end', () => {
    console.log('[server] 收到客户端的 FIN（客户端说"我发完了"）');
    console.log('[server] 这是"半关闭"：客户端不再发，但还能收');
    console.log('[server] 服务端回敬一个 FIN（附上一句告别），完成挥手');
    socket.end('（服务端的告别）');
  });
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log('[server] 监听在 127.0.0.1:' + port);
  console.log('');

  const client = net.createConnection({ host: '127.0.0.1', port }, () => {
    console.log('[client] connect 成功（在应用层看来，握手"瞬间"完成）');
    console.log('[client] 发送请求，然后立刻 end() —— 这叫"半关闭"');
    console.log('[client]   end() 会发一个 FIN，表示"我说完了"，但还能收数据');
    console.log('');
    client.write('给我一段话');
    client.end();
  });

  let received = '';
  client.on('data', (d) => {
    received += d.toString('utf8');
    console.log('[client] 收到一片段:', JSON.stringify(d.toString('utf8')));
  });

  client.on('end', () => {
    console.log('');
    console.log('[client] 收到服务端的 FIN，双向挥手完成');
    console.log('[client] 把收到的片段按顺序拼起来（可靠传输的体现）:');
    console.log('[client]   ' + JSON.stringify(received));
  });

  client.on('close', () => {
    console.log('[client] 连接完全关闭');
    server.close(() => {
      console.log('[server] 已关闭，进程自然退出');
    });
  });

  client.on('error', (err) => {
    console.log('[client] 出错:', err.code, err.message);
  });
});
