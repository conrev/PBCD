import * as THREE from 'three'

export class Character {

    constructor(meshData) {
        this.mesh = meshData.scene.children[0];
        this.animations = meshData.animations;
        this.clips = []
    }

    initializeObjectMesh(scene) {

        this.mesh.position.set(0,0,0);
        this.mixer = new THREE.AnimationMixer(this.mesh);
        const action = this.mixer.clipAction(this.animations[2]);
        action.play();
        
        this.clips.push(action);
        
        scene.add(this.mesh);
    }

    update(delta) {
        this.mixer.update( delta );

    }
}