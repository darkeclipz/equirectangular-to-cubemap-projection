Math.PI2 = Math.PI * 2;
const w = 650, h = 322.433;
let iw = w, ih = h; // image dimensions
const sourceCanvas = document.getElementById('source-map');

// Load source canvas image
const image = new Image();
image.src = 'equirectangular.png';
image.onload = () => {
    iw = sourceCanvas.width = image.width;
    ih = sourceCanvas.height = image.height;
    // Blur effect
    // sourceCanvas.getContext('2d').filter = 'blur(3px)'; // gives stripes...
};

// Cursor tracking on the source canvas.
let cursor = { x: Math.random() * w, y: Math.random() * h };
let isMoving = false;
let setCursorPosition = function(x, y) {
    cursor.x = x / w * iw;
    cursor.y = y / h * ih;
}

sourceCanvas.addEventListener('mousedown', 
    () => isMoving = true, 
    false
);

sourceCanvas.addEventListener('mouseup', 
    () => { 
        isMoving = false; 
        setCursorPosition(event.pageX - sourceCanvas.offsetLeft,
                          event.pageY - sourceCanvas.offsetTop);
        setTimeout(() => map(), 200);
    }, 
    false
);

sourceCanvas.addEventListener('mousemove', () => {
    if(isMoving) {
        setCursorPosition(event.pageX - sourceCanvas.offsetLeft,
                          event.pageY - sourceCanvas.offsetTop);
        map();
    }}, 
    false
);

// Animate the drawing of the cursor on the source canvas.
sourceCanvas.width = w; sourceCanvas.height = h;
const sourceCtx = sourceCanvas.getContext('2d');
animateSourceMapCanvas();

function animateSourceMapCanvas() {
    requestAnimationFrame(animateSourceMapCanvas);
    sourceCtx.clearRect(0, 0, w, h);
    sourceCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, iw, ih);
    sourceCtx.fillStyle = 'rgba(255,0,0,.5)';
    sourceCtx.beginPath();
    sourceCtx.arc(cursor.x, cursor.y, 6, 0, 2 * Math.PI);
    sourceCtx.fill();
}

// Set-up for THREE.js renderer.
const canvas = document.getElementById('projection-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas, antialias: true, alpha: true 
});
renderer.setSize(w, h);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
const light = new THREE.AmbientLight(0xafafaf);
scene.add(light);

// Add a unit cube to the scene, that encapsulates a unit sphere.
const boxSideLength = 1;
const boxGeometry = new THREE.BoxGeometry(boxSideLength, boxSideLength, boxSideLength);
const boxMaterial = new THREE.MeshPhongMaterial({ 
    color: 0xffffff, 
    side: THREE.DoubleSide,
    fog: true,
    transparent: true,
    opacity: 0.5,
    reflectivity: 0,
    envMap: scene.background,
    combine: THREE.MixOperation
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
    opacity: 0.25,
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
const dotMaterial = new THREE.PointsMaterial({ 
    size: 6, color: 0xff0000, sizeAttenuation: false 
});
const dot = new THREE.Points(dotGeometry, dotMaterial);
scene.add(dot);

// Draw a line between three points
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
const points = new Float32Array(3 * 3);
var lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
lineGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
var line = new THREE.Line(lineGeometry, lineMaterial);
scene.add(line);

camera.position.z = 3;
animate();

function animate() {
    requestAnimationFrame(animate);

    // Project the cursor to a 3D point on the unit sphere.
    const u = cursor.x / iw;
    const v = cursor.y / ih;
    const theta = u * Math.PI2 - Math.PI / 2;
    const phi = v * Math.PI;
    const z = Math.cos(theta) * Math.sin(phi);
    const x = Math.sin(theta) * Math.sin(phi);
    const y = Math.cos(phi);

    // Update the position of the point and the line.
    positions[0] = points[3] = x;
    positions[1] = points[4] = y;
    positions[2] = points[5] = z;

    // Draw another point at 'infinity'
    let d = 10000;
    points[6] = d * x;
    points[7] = d * y;
    points[8] = d * z;
 
    dot.geometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.position.needsUpdate = true;
    controls.update();
    renderer.render(scene, camera);
}

let planeCanvas;
let cubeMapCanvas = [];
let output = document.getElementById('output');

function map(size=100) {
    output.innerHTML = "Generating projection mapping...";
    setTimeout(() => {
        mapPlane("x+", size);
        mapPlane("x-", size);
        mapPlane("y+", size);
        mapPlane("y-", size);
        mapPlane("z+", size);
        mapPlane("z-", size);
        let images = [cubeMapCanvas.xpos, cubeMapCanvas.xneg, 
                      cubeMapCanvas.zpos, cubeMapCanvas.zneg,
                      cubeMapCanvas.ypos, cubeMapCanvas.yneg];
        let cubeTexture = new THREE.CubeTexture(images);
        scene.background = cubeTexture;
        scene.needsUpdate = true;
        cubeTexture.needsUpdate = true;
        boxMaterial.envMap = cubeTexture;
        boxMaterial.needsUpdate = true;
        output.innerHTML = "";
    }, 50);
}

let getPointOnUnitCubePlane = function(x, y, plane) {
    switch(plane) {
        case "x+":
            return { x: 0.5, 
                     y: 1 - x - 0.5,
                     z: 1 - y - 0.5 };
        case "x-":
            return { x: -0.5, 
                     y: x - 0.5,
                     z: 1 - y - 0.5 };
        case "y+":
            return { x: x - 0.5, 
                     y: 0.5,
                     z: 1 - y - 0.5 };
        case "y-":
            return { x: 1 - x - 0.5,
                     y: -0.5,
                     z: 1 - y - 0.5 };
        case "z+":
            return { x: x - 0.5,
                     y: y - 0.5,
                     z: 0.5 };
        case "z-":
            return { x: x - 0.5,
                     y: 1 - y - 0.5,
                     z: -0.5 };
    }
}

function mapPlane(plane, size) {

    // + or - isn't used in id's, so convert to something friendly. 
    let planeName = plane.replace('+', 'pos').replace('-', 'neg');
    cubeMapCanvas[planeName] = document.createElement('canvas');
    planeCanvas = cubeMapCanvas[planeName];
    planeCanvas.width = planeCanvas.height = size;
    planeCanvas.imageSmoothingEnabled = false;
    let ctx = planeCanvas.getContext('2d');    
    let img = document.getElementById('output-image-' + planeName);

    for(let x = 0; x < size; x++) {
        for(let y = 0; y < size; y++) {
            
            // Get the point on the unit cube.
            let p = getPointOnUnitCubePlane(x / size, y / size, plane);

            // Calculate spherical coordinates.
            let theta = Math.atan2(p.y, p.x);
            if(theta < 0) {
                theta += Math.PI2;
            }
            
            let r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
            let phi = Math.acos(p.z / r);

            // Calculate UV-coordinates for the texture lookup.
            let u = theta / Math.PI2 ;
            let v = phi / Math.PI;

            // Fetch the pixel from the source map.
            ctx.drawImage(sourceCanvas, u * iw, v * ih, 1, 1, x, y, 1, 1);
        }
    }

    // Update the cube map image with the result.
    img.src = planeCanvas.toDataURL();
}

setTimeout(map, 250);
