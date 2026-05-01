#!/bin/bash
echo "=== Test with 127.0.0.1 inside container ==="

# Write a temp test file to the container and run it
docker exec lawnova-roleplay-service sh -c "
node -e \"
const http = require('http');
const data = JSON.stringify({difficulty:'Easy',topic:'Random',userRole:'Defense'});
const req = http.request({
  hostname:'127.0.0.1', port:10005,
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
      if(j.success) { console.log('SUCCESS! Case:', j.data&&j.data.caseTitle); }
      else { console.log('FAIL error:', j.error); console.log('FAIL details:', j.details&&j.details.substring(0,200)); }
    } catch(e) { console.log('Body:', body.substring(0,400)); }
  });
});
req.on('error',e=>console.error('Error:',e.message));
req.write(data);
req.end();
\" 2>&1
" 

echo ""
echo "=== Confirm model in patched file ==="
docker exec lawnova-roleplay-service grep "GEMINI_MODEL = " /app/src/utils/aiOrchestrator.js | head -3
