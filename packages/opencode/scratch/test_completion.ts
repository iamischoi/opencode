
const response = await fetch('http://localhost:10043/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'SOLT1 의뢰',
    messages: [
      { role: 'user', content: 'hello' }
    ],
    stream: false
  })
});
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
