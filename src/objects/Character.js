import * as THREE from "three";
import { physicsConstants } from "../utils/Parameters";

export class Character {
	constructor(meshData) {
		this.mesh = meshData.scene;
		this.animations = meshData.animations;
		this.clips = [];
	}

	initializeObjectMesh(scene) {
		this.mesh.position.set(0, 0, 0);
		this.mesh.scale.set(0.05, 0.05, 0.05);
		this.mixer = new THREE.AnimationMixer(this.mesh);
		const action = this.mixer.clipAction(this.animations[1]);
		action.play();

		this.clips.push(action);

		scene.add(this.mesh);
	}

	update(delta) {
		this.mixer.update(physicsConstants.dt);
	}
}
