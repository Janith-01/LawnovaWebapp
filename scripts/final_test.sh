#!/bin/bash
echo "=== Final endpoint test ==="

# Test via direct curl from the roleplay container itself
docker exec lawnova-roleplay-service node -e "
const http = require('http');
const data = JSON.stringify({difficulty:'Easy',topic:'Random',userRole:'Defense'});
const req = http.request({
  hostname:'localhost', port:10005,
  path:'/api/roleplay/generate-case',
  method:'POST',
  headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}
}, (res) => {
  let body='';
  res.on('data',c=>body+=c);
  res.on('end',()=>{
    console.log('HTTP Status:', res.statusCode);
    try {
      const j=JSON.parse(body);
      if(j.success) console.log('SUCCESS! Case:', j.data&&j.data.caseTitle);
      else console.log('FAIL:', j.error, j.details||'');
    } catch(e) { console.log('Body:', body.substring(0,300)); }
  });
});
req.on('error',e=>console.error('Request error:',e.message));
req.write(data);
req.end();
" 2>&1

echo ""
echo "=== Recent logs ==="
docker logs lawnova-roleplay-service --tail=15 2>&1
