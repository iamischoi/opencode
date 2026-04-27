
const response = await fetch('http://localhost:10043/v1/models');
const data = await response.json();
console.log(JSON.stringify(data, null, 2));
