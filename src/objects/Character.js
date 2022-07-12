import * as THREE from 'three'
import { AnimationMixer, Vector3 } from 'three';

export class Character {

    constructor(meshData) {
        this.mesh = meshData.scene.children[0];
        this.animations = meshData.animations;
        this.clips = []
    }

    initializeObjectMesh(scene) {

        this.mesh.position.set(0,0,0);
        this.mesh.scale.set(0.2,0.2,0.2);
        this.mixer = new AnimationMixer(this.mesh);
        console.log(this.mesh);
        console.log(this.animations);
        const action = this.mixer.clipAction(this.animations[2]);
        action.play();
        this.clips.push(action);
        
        scene.add(this.mesh);
    }

    update(delta) {
        this.mixer.update( delta );

    }
}