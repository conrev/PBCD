import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { SandboxObject } from "./objects/SandboxObject";
import { Grabber } from "./objects/Grabber";
import {
	physicsConstants,
	physicsParameters,
	sandboxAssets,
} from "./utils/Parameters";
import { Character } from "./objects/Character";

let gThreeScene;
let gRenderer;
let gComposer;
let gCamera;
let gCameraControl;
let gGrabber;
let gStatsMonitor;
let gMouseDown = false;
let gRuntimeObjects = {
	objects: [],
};
let gClock;

// workaround for lilgui not supporting function parameters
let spawnedObjectName = sandboxAssets["Suzanne"];

// ------------------------------------------------------------------

async function getData(url) {
	const response = await fetch(url);
	return response.json();
}

async function instiantiateSandboxObject() {
	const meshData = await getData(spawnedObjectName);
	const object = new SandboxObject(meshData);
	object.initializeObjectMesh(gThreeScene);
	object.initializeAnimation();
	gRuntimeObjects.objects.push(object);
}

async function instantiateCharacter() {
	const loader = new GLTFLoader();

	const meshData = await loader.loadAsync("assets/Fox.glb");
	const character = new Character(meshData);

	character.initializeObjectMesh(gThreeScene);
	gRuntimeObjects.objects.push(character);
}

function initThreeScene() {
	gThreeScene = new THREE.Scene();

	// Lights
	gThreeScene.background = new THREE.Color(0xa0a0a0);
	gThreeScene.fog = new THREE.Fog(0xa0a0a0, 1, 50);

	const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
	hemiLight.position.set(0, 50, 0);
	gThreeScene.add(hemiLight);

	const dirLight = new THREE.DirectionalLight(0xffffff);
	dirLight.position.set(-3, 10, 3);
	dirLight.castShadow = true;
	dirLight.shadow.camera.top = 2;
	dirLight.shadow.camera.bottom = -2;
	dirLight.shadow.camera.left = -2;
	dirLight.shadow.camera.right = 2;
	dirLight.shadow.camera.near = 0.1;
	dirLight.shadow.camera.far = 40;
	gThreeScene.add(dirLight);

	// Geometry

	const ground = new THREE.Mesh(
		new THREE.PlaneBufferGeometry(100, 100, 1, 1),
		new THREE.MeshPhongMaterial({ color: 0xa0adaf, shininess: 150 })
	);

	ground.rotation.x = -Math.PI / 2; // rotates X/Y to X/Z
	ground.receiveShadow = true;
	gThreeScene.add(ground);

	// Renderer

	gRenderer = new THREE.WebGLRenderer();
	gRenderer.shadowMap.enabled = true;
	gRenderer.setPixelRatio(window.devicePixelRatio);
	gRenderer.setSize(window.innerWidth, window.innerHeight);
	window.addEventListener("resize", onWindowResize, false);
	container.appendChild(gRenderer.domElement);

	// Camera

	gCamera = new THREE.PerspectiveCamera(
		70,
		window.innerWidth / window.innerHeight,
		0.1,
		500
	);
	gCamera.position.set(0, 1, 2);

	gCamera.updateMatrixWorld();

	gThreeScene.add(gCamera);

	gCameraControl = new OrbitControls(gCamera, gRenderer.domElement);
	gCameraControl.zoomSpeed = 2.0;
	gCameraControl.panSpeed = 0.4;

	// PostProcessing

	const renderPass = new RenderPass(gThreeScene, gCamera);
	const bokehPass = new BokehPass(gThreeScene, gCamera, {
		focus: 0.5,
		aperture: 0.005,
		maxblur: 0.01,
		width: window.innerWidth,
		height: window.innerHeight,
	});

	gComposer = new EffectComposer(gRenderer);

	gComposer.addPass(renderPass);
	//gComposer.addPass(bokehPass);

	// grabber

	gGrabber = new Grabber(gRenderer, gThreeScene, gCamera);
	container.addEventListener("pointerdown", onPointer, false);
	container.addEventListener("pointermove", onPointer, false);
	container.addEventListener("pointerup", onPointer, false);

	// performance monitoring

	gStatsMonitor = Stats();
	container.appendChild(gStatsMonitor.domElement);

	// graphics clock - delta measurement
	gClock = new THREE.Clock();
}

function onPointer(evt) {
	evt.preventDefault();
	if (evt.type == "pointerdown") {
		gGrabber.start(evt.clientX, evt.clientY);
		gMouseDown = true;
		if (gGrabber.physicsObject) {
			gCameraControl.enabled = false;
		}
	} else if (evt.type == "pointermove" && gMouseDown) {
		gGrabber.move(evt.clientX, evt.clientY);
	} else if (evt.type == "pointerup") {
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
		subStep: 5,
		edgeCompliance: 50,
		spawnedSandbox: sandboxAssets["Dragon"],
		spawnPhysicsObject: instiantiateSandboxObject,
		spawnAnimatedCharacter: instantiateCharacter,
		pausePhysics: false,
		gravity: 10,
		dampingFactor: 0.995,
	};

	panel.add(elements, "spawnPhysicsObject").name("Spawn sandbox object");
	panel
		.add(elements, "spawnedSandbox", sandboxAssets)
		.name("Object to spawn:")
		.listen()
		.onChange((value) => {
			spawnedObjectName = value;
		});
	panel
		.add(elements, "spawnAnimatedCharacter")
		.name("Spawn preanimated character");

	panel
		.add(elements, "pausePhysics")
		.name("Pause physics simulation")
		.listen()
		.onChange((value) => {
			physicsParameters.paused = value;
		});
	panel
		.add(elements, "subStep", 1, 10, 1)
		.name("Substeps per iteration")
		.listen()
		.onChange((value) => {
			physicsParameters.numSubsteps = value;
		});
	panel
		.add(elements, "edgeCompliance", 0, 500, 50)
		.name("Edge compliance")
		.listen()
		.onChange((value) => {
			for (let i = 0; i < gRuntimeObjects.objects.length; i++) {
				gRuntimeObjects.objects[i].body.edgeCompliance = value;
			}
		});
	panel
		.add(elements, "gravity", 5, 10, 1)
		.name("Gravity")
		.listen()
		.onChange((value) => {
			physicsParameters.gravity[1] = -value;
		});
	panel
		.add(elements, "dampingFactor", 0.9, 1, 0.005)
		.name("Artificial Damping")
		.listen()
		.onChange((value) => {
			for (let i = 0; i < gRuntimeObjects.objects.length; i++)
				gRuntimeObjects.objects[i].body.dampingFactor = value;
		});
}

function onWindowResize() {
	gCamera.aspect = window.innerWidth / window.innerHeight;
	gCamera.updateProjectionMatrix();
	gComposer.setSize(window.innerWidth, window.innerHeight);
}

function update() {
	gRuntimeObjects.objects.forEach((element) => {
		element.update(gClock.getDelta());
	});

	gGrabber.increaseTime(physicsConstants.dt);
	gComposer.render(physicsConstants.dt);
	gStatsMonitor.update();
	requestAnimationFrame(update);
}

initThreeScene();
initGUI();
onWindowResize();
update();
