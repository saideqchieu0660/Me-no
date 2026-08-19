import http from 'http';
http.get('http://localhost:3000/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log("STATUS:", res.statusCode, "\\nBODY_PREVIEW:", data.substring(0, 500)));
});
