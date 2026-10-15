import {rotationMatrix,type View3D} from './sky-3d';
// Render the generated Milky Way as a surrounding environment, viewed through a 3D camera.
export function createPanorama(canvas:HTMLCanvasElement,onReady:()=>void){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});if(!gl)return null;
 const vertex='attribute vec2 position; varying vec2 uv; void main(){ uv=position; gl_Position=vec4(position,0.,1.); }';
 const fragment=`precision highp float;
 varying vec2 uv; uniform sampler2D sky; uniform float aspect; uniform float zoom; uniform mat3 rotation;
 void main(){
  vec3 ray=normalize(vec3(uv.x*aspect,-uv.y,-1.05*zoom));
  vec3 direction=ray*rotation;
  float u=.55+atan(direction.x,-direction.z)/6.28318530;
  float v=.5+asin(clamp(direction.y,-1.,1.))/3.14159265;
  vec2 sampleUV=vec2(fract(u),clamp(v,0.002,.998));
  vec3 color=texture2D(sky,sampleUV).rgb;
  float shade=mix(.66,1.0,smoothstep(-1.,.6,uv.x));
  float vignette=1.-.14*dot(uv,uv);
  gl_FragColor=vec4(color*shade*vignette+vec3(.002,.004,.009),1.);
 }`;
 const shaders:WebGLShader[]=[];
 const compile=(type:number,source:string)=>{const s=gl.createShader(type);if(!s)throw Error('shader');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('compile');return s};
 let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null,texture:WebGLTexture|null=null,loaded=false,disposed=false;
 let lastView:View3D={yaw:0,pitch:0,roll:0,zoom:1};
 try{program=gl.createProgram();if(!program)throw Error('program');gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');gl.useProgram(program);
 buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
 texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 }catch{shaders.forEach(s=>gl.deleteShader(s));if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);if(texture)gl.deleteTexture(texture);return null}
 const aspect=gl.getUniformLocation(program,'aspect'),zoom=gl.getUniformLocation(program,'zoom'),rotation=gl.getUniformLocation(program,'rotation');
 const draw=(v:View3D)=>{lastView=v;if(!loaded||disposed||gl.isContextLost())return;const dpr=Math.min(devicePixelRatio||1,1.75),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.useProgram(program);gl.uniform1f(aspect,w/h);gl.uniform1f(zoom,v.zoom);gl.uniformMatrix3fv(rotation,false,rotationMatrix(v));gl.drawArrays(gl.TRIANGLES,0,6)};
 const image=new Image();image.onload=()=>{if(disposed)return;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);loaded=true;draw(lastView);onReady()};image.src='/images/deep-space-panorama.png';
 const resize=()=>draw(lastView);window.addEventListener('resize',resize);
 return {draw,dispose(){disposed=true;image.onload=null;window.removeEventListener('resize',resize);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);gl.deleteBuffer(buffer);gl.deleteTexture(texture)}};
}
