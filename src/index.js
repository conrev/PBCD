import * as THREE from 'three' 
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { DeformableObject } from './graphics/DeformableObject'
import {CylinderObject} from './graphics/CyclinderObject'
import { Grabber } from './graphics/Grabber'

var gThreeScene;
var gRenderer;
var gCamera;
var gCameraControl;
var gGrabber;
var gMouseDown = false;


// ------------------------------------------------------------------

var gPhysicsScene = 
{
    gravity : [0.0, -10.0, 0.0],
    dt : 1.0 / 60.0,
    numSubsteps : 5,
    paused: false,
    objects: [],				
};

async function getData(url) {
    const response = await fetch(url);
    //console.log(response.json())
    return response.json();
}

// ------------------------------------------------------------------
async function initPhysics() 
{

    var meshData = await getData('SuzanneTet.obj.json')
    let body = new DeformableObject(meshData, gThreeScene)

    document.getElementById("numTets").innerHTML = body.numTets;

    gPhysicsScene.objects.push(body); 
}

async function initCylinder(){
    var meshData = await getData('CyclTet.obj.json')
    var body = new CylinderObject(meshData, gThreeScene);

    gPhysicsScene.objects.push(body); 
    document.getElementById("numTets").innerHTML = body.numTets;
}

// ------------------------------------------------------------------
function simulate() 
{
    
    if (gPhysicsScene.paused){
        console.log("paused")
        return;
    
    }
        
    var sdt = gPhysicsScene.dt / gPhysicsScene.numSubsteps;

    for (var i = 0; i < gPhysicsScene.objects.length; i++) 
        if(gPhysicsScene.objects[i].hasAnimation)
            gPhysicsScene.objects[i].animateBones();

    for (var step = 0; step < gPhysicsScene.numSubsteps; step++) {
        
        for (var i = 0; i < gPhysicsScene.objects.length; i++) 
            gPhysicsScene.objects[i].preSolve(sdt, gPhysicsScene.gravity);
        
        for (var i = 0; i < gPhysicsScene.objects.length; i++) 
            gPhysicsScene.objects[i].solve(sdt);

        for (var i = 0; i < gPhysicsScene.objects.length; i++) 
            gPhysicsScene.objects[i].postSolve(sdt);
        


    }
    

    gGrabber.increaseTime(gPhysicsScene.dt);
}

// ------------------------------------------
        
function initThreeScene() 
{
    gThreeScene = new THREE.Scene();
    
    // Lights
    
    gThreeScene.add( new THREE.AmbientLight( 0x505050 ) );	
    gThreeScene.fog = new THREE.Fog( 0x000000, 0, 15 );				

    var spotLight = new THREE.SpotLight( 0xffffff );
    spotLight.angle = Math.PI / 5;
    spotLight.penumbra = 0.2;
    spotLight.position.set( 2, 3, 3 );
    spotLight.castShadow = true;
    spotLight.shadow.camera.near = 3;
    spotLight.shadow.camera.far = 10;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    gThreeScene.add( spotLight );

    var dirLight = new THREE.DirectionalLight( 0x55505a, 1 );
    dirLight.position.set( 0, 3, 0 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 10;

    dirLight.shadow.camera.right = 1;
    dirLight.shadow.camera.left = - 1;
    dirLight.shadow.camera.top	= 1;
    dirLight.shadow.camera.bottom = - 1;

    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    gThreeScene.add( dirLight );
    
    // Geometry

    var ground = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 20, 20, 1, 1 ),
        new THREE.MeshPhongMaterial( { color: 0xa0adaf, shininess: 150 } )
    );				

    ground.rotation.x = - Math.PI / 2; // rotates X/Y to X/Z
    ground.receiveShadow = true;
    gThreeScene.add( ground );
    
    var helper = new THREE.GridHelper( 20, 20 );
    helper.material.opacity = 1.0;
    helper.material.transparent = true;
    helper.position.set(0, 0.002, 0);
    gThreeScene.add( helper );				
    
    // Renderer

    gRenderer = new THREE.WebGLRenderer();
    gRenderer.shadowMap.enabled = true;
    gRenderer.setPixelRatio( window.devicePixelRatio );
    gRenderer.setSize( 0.8 * window.innerWidth, 0.8 * window.innerHeight );
    window.addEventListener( 'resize', onWindowResize, false );
    container.appendChild( gRenderer.domElement );
    
    // Camera
            
    gCamera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100);
    gCamera.position.set(0, 1, 2);
    gCamera.updateMatrixWorld();	

    gThreeScene.add(gCamera);

    gCameraControl = new OrbitControls(gCamera, gRenderer.domElement);
    gCameraControl.zoomSpeed = 2.0;
    gCameraControl.panSpeed = 0.4;

    // grabber

    gGrabber = new Grabber(gRenderer, gThreeScene, gCamera);
    container.addEventListener( 'pointerdown', onPointer, false );
    container.addEventListener( 'pointermove', onPointer, false );
    container.addEventListener( 'pointerup', onPointer, false );
}

function onPointer( evt ) 
{
    evt.preventDefault();
    if (evt.type == "pointerdown") {
        gGrabber.start(evt.clientX, evt.clientY);
        gMouseDown = true;
        if (gGrabber.physicsObject) {
            gCameraControl.enabled = false;
        }
    }
    else if (evt.type == "pointermove" && gMouseDown) {
        gGrabber.move(evt.clientX, evt.clientY);
    }
    else if (evt.type == "pointerup") {
        if (gGrabber.physicsObject) {
            gGrabber.end();
            gCameraControl = new OrbitControls(gCamera, gRenderer.domElement);
            gCameraControl.zoomSpeed = 2.0;
            gCameraControl.panSpeed = 0.4;
        }
        gMouseDown = false;
    }
}	

document.getElementById("complianceSlider").oninput = function () {
    for (var i = 0; i < gPhysicsScene.objects.length; i++) 
        gPhysicsScene.objects[i].edgeCompliance = this.value * 50.0;
}

document.getElementById("dampingSlider").oninput = function ()  {
    for (var i = 0; i < gPhysicsScene.objects.length; i++) 
        gPhysicsScene.objects[i].dampingFactor = this.value / 100.0;
}

document.getElementById("spawnPhysicsObjectButton").onclick = function () {
    initPhysics();
};

document.getElementById("spawnAnimatedObjectButton").onclick = function () {
    initCylinder();
};






// ------------------------------------------------------

function onWindowResize() {

    gCamera.aspect = window.innerWidth / window.innerHeight;
    gCamera.updateProjectionMatrix();
    gRenderer.setSize( window.innerWidth, window.innerHeight );
}

function run() {
    var button = document.getElementById('buttonRun');
    if (gPhysicsScene.paused)
        button.innerHTML = "Stop";
    else
        button.innerHTML = "Run";
    gPhysicsScene.paused = !gPhysicsScene.paused;
}

function restart() {
    location.reload();
}

function squash() {
    for (var i = 0; i < gPhysicsScene.objects.length; i++)
        gPhysicsScene.objects[i].squash();
    if (!gPhysicsScene.paused)
        run();
}

function newBody() {
    body = new DeformableMesh(bunnyMesh, gThreeScene);
    body.translate(-1.0 + 2.0 * Math.random(), 0.0, -1.0 + 2.0 * Math.random());
    gPhysicsScene.objects.push(body); 
    
    var numTets = 0;
    for (var i = 0; i < gPhysicsScene.objects.length; i++)
        numTets += gPhysicsScene.objects[i].numTets;
    document.getElementById("numTets").innerHTML = numTets;
}

// make browser to call us repeatedly -----------------------------------

function update() {
    simulate();
    gRenderer.render(gThreeScene, gCamera);
    requestAnimationFrame(update);
}

//loadMesh();
initThreeScene();
onWindowResize();
update();  