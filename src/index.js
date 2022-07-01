import * as THREE from 'three' 
import Stats from 'three/examples/jsm/libs/stats.module'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { DeformableObject } from './graphics/DeformableObject'
import { CylinderObject } from './graphics/CyclinderObject'
import { Grabber } from './graphics/Grabber'

let gThreeScene;
let gRenderer;
let gComposer;
let gCamera;
let gCameraControl;
let gGrabber;
let gMouseDown = false;
let gStatsMonitor;

// ------------------------------------------------------------------

let gPhysicsScene = 
{
    gravity : [0.0, -10.0, 0.0],
    dt : 1.0 / 60.0,
    numSubsteps : 5,
    paused: false,
    objects: [],				
};

async function getData(url) {
    const response = await fetch(url);
    return response.json();
}

// ------------------------------------------------------------------
async function initPhysics() {
    let meshData = await getData('assets/SuzanneTet.obj.json')
    let body = new DeformableObject(meshData, gThreeScene)

    gPhysicsScene.objects.push(body); 

    for (let i = 0; i < gPhysicsScene.objects.length; i++)
        numTets += gPhysicsScene.objects[i].numTets;  
}

async function initCylinder() {
    let meshData = await getData('assets/CyclTet.obj.json')
    let body = new CylinderObject(meshData, gThreeScene);

    gPhysicsScene.objects.push(body); 

    for (let i = 0; i < gPhysicsScene.objects.length; i++)
        numTets += gPhysicsScene.objects[i].numTets;

}

// ------------------------------------------------------------------
function simulate() 
{
        
    let sdt = gPhysicsScene.dt / gPhysicsScene.numSubsteps;

    for (let i = 0; i < gPhysicsScene.objects.length; i++) 
        if(gPhysicsScene.objects[i].hasAnimation)
            gPhysicsScene.objects[i].animateBones();

    // If paused, dont continue to next step

    if (gPhysicsScene.paused)
        return;
               
    for (let step = 0; step < gPhysicsScene.numSubsteps; step++) {
        
        for (let i = 0; i < gPhysicsScene.objects.length; i++) 
            gPhysicsScene.objects[i].preSolve(sdt, gPhysicsScene.gravity);
        
        for (let i = 0; i < gPhysicsScene.objects.length; i++) 
            gPhysicsScene.objects[i].solve(sdt);

        for (let i = 0; i < gPhysicsScene.objects.length; i++) 
            gPhysicsScene.objects[i].postSolve(sdt);

    }
    
    gGrabber.increaseTime(gPhysicsScene.dt);
}

// ------------------------------------------
        
function initThreeScene() 
{
    gThreeScene = new THREE.Scene();
    
    // Lights
    gThreeScene.background = new THREE.Color( 0xa0a0a0 );
    gThreeScene.fog  = new THREE.Fog( 0xa0a0a0, 1, 50);
    
    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
    hemiLight.position.set( 0, 20, 0 );
    gThreeScene.add( hemiLight );

    const dirLight = new THREE.DirectionalLight( 0xffffff );
    dirLight.position.set( -3 , 10, 3 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 2;
    dirLight.shadow.camera.bottom = - 2;
    dirLight.shadow.camera.left = - 2;
    dirLight.shadow.camera.right = 2;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 40;
    gThreeScene.add( dirLight );

    // Geometry

    const ground = new THREE.Mesh(
        new THREE.PlaneBufferGeometry( 100, 100, 1, 1 ),
        new THREE.MeshPhongMaterial( { color: 0xa0adaf, shininess: 150 } )
    );				

    ground.rotation.x = - Math.PI / 2; // rotates X/Y to X/Z
    ground.receiveShadow = true;
    gThreeScene.add( ground );
    
    // Renderer

    gRenderer = new THREE.WebGLRenderer();
    gRenderer.shadowMap.enabled = true;
    gRenderer.setPixelRatio( window.devicePixelRatio );
    gRenderer.setSize( window.innerWidth, window.innerHeight );
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
    
    // PostProcessing

    const renderPass = new RenderPass( gThreeScene, gCamera );
    const bokehPass = new BokehPass ( gThreeScene, gCamera, {
        focus : 0.5 ,
        aperture :0.005,
        maxblur : 0.01,
        width : window.innerWidth,
        height : window.innerHeight
    })

    gComposer = new EffectComposer( gRenderer );

    gComposer.addPass(renderPass);
    //gComposer.addPass(bokehPass);

    // grabber

    gGrabber = new Grabber(gRenderer, gThreeScene, gCamera);
    container.addEventListener( 'pointerdown', onPointer, false );
    container.addEventListener( 'pointermove', onPointer, false );
    container.addEventListener( 'pointerup', onPointer, false );

    // performance monitoring
    
    gStatsMonitor = Stats();
    container.appendChild(gStatsMonitor.domElement);


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

function initGUI() {
    const panel = new GUI();

    const elements = {
        subStep : 5,
        edgeCompliance : 50,
        spawnPhysicsObject: initPhysics,
        spawnAnimatedObject: initCylinder,
        pausePhysics: false 
    }
    
    panel.add(elements, 'spawnPhysicsObject').name('Spawn Pure Physics Object');
    panel.add(elements, 'spawnAnimatedObject').name('Spawn Preanimated Object');
    panel.add(elements, 'pausePhysics').name('Pause Physics Simulation').listen()
        .onChange( value => {
            gPhysicsScene.paused = value;
        } 
    );
    panel.add(elements, 'subStep', 1, 10, 1).name('Substeps per Iteration').listen()
        .onChange( value => {
            gPhysicsScene.numSubsteps = value;
        } 
    );
    panel.add(elements, 'edgeCompliance', 0, 500, 50).name('Edge Compliance').listen()
        .onChange( value => {
            for (let i = 0; i < gPhysicsScene.objects.length; i++) 
              gPhysicsScene.objects[i].edgeCompliance = value;
        } 
    );
}

// ------------------------------------------------------

function onWindowResize() {
    gCamera.aspect = window.innerWidth / window.innerHeight;
    gCamera.updateProjectionMatrix();
    gRenderer.setSize( window.innerWidth, window.innerHeight );
}

// make browser to call us repeatedly -----------------------------------

function update() {
    simulate();
    gComposer.render(gPhysicsScene.dt);
    gStatsMonitor.update()
    requestAnimationFrame(update);
}

//loadMesh();
initThreeScene();
initGUI();
onWindowResize();
update();  