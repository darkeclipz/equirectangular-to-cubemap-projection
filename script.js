const w = 650, h = 322.433;

// Load source canvas image
const image = new Image();
image.src = 'equirectangular.png';

const sourceCanvas = document.getElementById('source-map');
let cursor = { x: Math.random() * w, y: Math.random() * h };
let isMoving = false;
sourceCanvas.addEventListener('mousedown', 
    () => isMoving = true, false);
sourceCanvas.addEventListener('mouseup', 
    () => { 
        isMoving = false; 
        cursor.x = event.pageX - sourceCanvas.offsetLeft;
        cursor.y = event.pageY - sourceCanvas.offsetTop;
        setTimeout(() => map(), 200);
    }, false);
sourceCanvas.addEventListener('mousemove', () => {
    if(isMoving) {
        cursor.x = event.pageX - sourceCanvas.offsetLeft;
        cursor.y = event.pageY - sourceCanvas.offsetTop;
        map();
    }
}, false);
sourceCanvas.width = w; sourceCanvas.height = h;
const sourceCtx = sourceCanvas.getContext('2d');
sourceCtx.fillStyle = 'rgba(255,0,0,.5)';
animateSourceMapCanvas();

function animateSourceMapCanvas() {
    requestAnimationFrame(animateSourceMapCanvas);
    sourceCtx.clearRect(0, 0, w, h);
    sourceCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, w, h);
    sourceCtx.beginPath();
    sourceCtx.arc(cursor.x, cursor.y, 6, 0, 2 * Math.PI);
    sourceCtx.fill();
}

const canvas = document.getElementById('projection-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setSize(w, h);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
const light = new THREE.AmbientLight(0xafafaf);
scene.add(light);

// Add a box to the scene, that encapsulates a unit sphere.
const boxSideLength = 2;
const boxGeometry = new THREE.BoxGeometry(boxSideLength, boxSideLength, boxSideLength);
const boxMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    side: THREE.DoubleSide,
    fog: true,
    transparent: true,
    opacity: 0.3,
});

const cube = new THREE.Mesh(boxGeometry, boxMaterial);
scene.add(cube);

// Add a unit sphere to the scene.
const sphereGeometry = new THREE.SphereGeometry(1, 40, 40);
const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    fog: true,
    transparent: true,
    opacity: 0.5,
    depthTest: false
});

const textureLoader = new THREE.TextureLoader();
textureLoader.load('equirectangular.png', 
    (tex) => {
        sphereMaterial.map = tex;
        sphereMaterial.needsUpdate = true;
    }, 
    undefined, 
    () => console.warn('failed to load texture') 
);

const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

// Add the zero vector to the scene.
const dotGeometry = new THREE.BufferGeometry();
const numOfPoints = 2;
const positions = new Float32Array(3 * numOfPoints);
dotGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const dotMaterial = new THREE.PointsMaterial({ size: 6, color: 0xff0000, sizeAttenuation: false });
const dot = new THREE.Points(dotGeometry, dotMaterial);
scene.add(dot);

// Draw a line between three points
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
const points = new Float32Array(2 * 3);
var lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
lineGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
var line = new THREE.Line(lineGeometry, lineMaterial);
scene.add(line);

camera.position.z = 3;
animate();

function animate() {
    requestAnimationFrame(animate);
    const u = cursor.x / w;
    const v = cursor.y / h;
    const theta = u * Math.PI * 2 - Math.PI / 2;
    const phi = v * Math.PI;
    const z = Math.cos(theta) * Math.sin(phi);
    const x = Math.sin(theta) * Math.sin(phi);
    const y = Math.cos(phi);

    positions[0] = points[3] = x;
    positions[1] = points[4] = y;
    positions[2] = points[5] = z;

    dot.geometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
}

let cubeTextureCanvas;
let emptyCanvas;

let cubeMapCanvas = [];
const size = 100;

function map() {
    mapPlane("x+");
    mapPlane("x-");
    mapPlane("y+");
    mapPlane("y-");
    mapPlane("z+");
    mapPlane("z-");

    emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = emptyCanvas.height = size;
    let images = [cubeMapCanvas.xpos, cubeMapCanvas.xneg, 
                  cubeMapCanvas.zpos, cubeMapCanvas.zneg,
                  cubeMapCanvas.ypos, cubeMapCanvas.yneg];

    let cubeTexture = new THREE.CubeTexture(images);
    scene.background = cubeTexture;
    scene.needsUpdate = true;
    cubeTexture.needsUpdate = true;
}

function mapPlane(plane) {
    let planeName = plane.replace('+', 'pos').replace('-', 'neg');
    cubeMapCanvas[planeName] = document.createElement('canvas');
    cubeTextureCanvas = cubeMapCanvas[planeName];
    
    cubeTextureCanvas.width = cubeTextureCanvas.height = size;
    let ctx = cubeTextureCanvas.getContext('2d');    
    let img = document.getElementById('output-image-' + planeName);


    Math.PI2 = Math.PI * 2;

    let getPlanePosition = function(x, y, s, plane) {
        let d = 0.5;
        switch(plane) {
            case "x+":
                return { x: d, 
                         y: (1 - x / s) - 0.5,
                         z: (1 - y / s) - 0.5 };
            case "x-":
                return { x: -d, 
                         y: x / s - 0.5,
                         z: (1 - y / s) - 0.5 };
            case "y+":
                return { x: x / s - 0.5, 
                         y: d,
                         z: (1 - y / s) - 0.5 };
            case "y-":
                return { x: (1 - x / s) - 0.5,
                         y: -d,
                         z: (1 - y / s) - 0.5 };
            case "z+":
                return { x: x / s - 0.5,
                         y: y / s - 0.5,
                         z: d };
            case "z-":
                return { x: x / s - 0.5,
                         y: (1 - y / s) - 0.5,
                         z: -d };
        }
    }

    for(let x = 0; x < size; x++) {
        for(let y = 0; y < size; y++) {

            let p = getPlanePosition(x, y, size, plane);
            let theta = Math.atan2(p.y, p.x);
            
            if(theta < 0) {
                theta += Math.PI2;
            }

            let r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
            let phi = Math.acos(p.z / r);

            let u = theta / Math.PI2 * w;
            let v = phi / Math.PI * h;

            ctx.drawImage(sourceCanvas, u, v, 1, 1, x, y, 1, 1);
        }
    }

    img.src = cubeTextureCanvas.toDataURL();
}

setTimeout(map, 50);
