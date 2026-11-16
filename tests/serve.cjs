// Мини-сервер статики для тестов
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');const types={html:'text/html; charset=utf-8',js:'text/javascript',json:'application/json',png:'image/png',webmanifest:'application/manifest+json'};
module.exports=port=>new Promise(r=>{const s=http.createServer((q,a)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){a.writeHead(404);return a.end()}a.writeHead(200,{'Content-Type':types[f.split('.').pop()]||'application/octet-stream'});fs.createReadStream(f).pipe(a)}).listen(port,()=>r(s))});
if(require.main===module)module.exports(+process.env.PORT||8765);
