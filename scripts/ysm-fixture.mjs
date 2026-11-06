// Original, deterministic test content (CC0-1.0). Contains no third-party models.
// Exercise the actual V1 parser, not a mock of its extracted filesystem.
import {createCipheriv} from 'node:crypto';
import {deflateSync} from 'node:zlib';

export function createYsmFixture(){
 const geometry={format_version:'1.12.0','minecraft:geometry':[{
  description:{identifier:'geometry.ysm_smoke',texture_width:1,texture_height:1},
  bones:[{name:'body',pivot:[0,0,0],cubes:[{origin:[-1,0,-1],size:[2,2,2],uv:{north:{uv:[0,0],uv_size:[1,1]}}}]}]
 }]};
 const animation={format_version:'1.8.0',animations:{idle:{loop:true,animation_length:1,bones:{body:{rotation:{'0':[0,0,0],'1':[0,15,0]}}}}}};
 const resources=[['main.json',Buffer.from(JSON.stringify(geometry))],['main.animation.json',Buffer.from(JSON.stringify(animation))],
  ['normal.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')]];
 const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
 const key=Buffer.alloc(16,0x42),iv=Buffer.alloc(16,0x24);
 const parts=[Buffer.from('YSGP'),u32(1),Buffer.alloc(16)];
 for(const [name,data] of resources){
  const filename=Buffer.from(name),cipher=createCipheriv('aes-128-cbc',key,iv);
  const encrypted=Buffer.concat([cipher.update(deflateSync(data)),cipher.final()]);
  parts.push(u32(filename.length),filename,u32(encrypted.length),key,iv,encrypted);
 }
 return Buffer.concat(parts);
}
