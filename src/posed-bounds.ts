/** Bounds from rendered vertices, including current animated ancestors and scale. */
export function posedCubeCorners(cube:any):[number,number,number][] {
  const mesh=cube.mesh;
  if(!mesh?.geometry?.attributes?.position)throw Error('Rendered cube geometry unavailable for screenshot framing');
  for(let node=mesh;node;node=node.parent)if(node.visible===false)return [];
  mesh.updateWorldMatrix(true,false);
  const p=mesh.geometry.attributes.position,m=mesh.matrixWorld.elements;
  // Blockbench clamps an animated [0,0,0] scale to 1e-5. Such hidden
  // parts must not contribute their distant translation to the frame.
  if([0,4,8].every(i=>Math.hypot(m[i],m[i+1],m[i+2])<=1.01e-5))return [];
  const points:[number,number,number][]=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const w=m[3]*x+m[7]*y+m[11]*z+m[15];
    points.push([(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w]);
  }
  return points;
}
