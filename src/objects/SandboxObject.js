import * as THREE from "three";
import * as FlatMath from "../utils/MathOperations"
import { DeformableBody } from "../physics/DeformableBody";
import { physicsConstants, physicsParameters } from "../utils/Parameters";

export class SandboxObject {
    constructor(meshData) {
        /**
         *
         * Initialize ThreeJS representation of this object
         * and make it visible in the current scene
         *
         * @param {THREE.Scene} scene scene to add the object into
         *
         */

        this.body = new DeformableBody(meshData);
        this.active = false;
        this.hasAnimation = false;
    }

    initializeObjectMesh(scene) {
        /**
         *
         * Initialize ThreeJS representation of this object
         * and make it visible in the current scene
         *
         * @param {THREE.Scene} scene scene to add the object into
         *
         */
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(this.body.pos, 3)
        );
        geometry.setIndex(this.body.edgeIds);
        var lineMaterial = new THREE.LineBasicMaterial({color: 0xffffff, linewidth: 2});
        this.tetMesh = new THREE.LineSegments(geometry, lineMaterial);
        this.tetMesh.visible = true;


        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * this.body.numVisVerts), 3));
        geometry.setIndex(this.body.triIds);
        var visMaterial = new THREE.MeshPhongMaterial({color: 0xf78a1d});
        this.visMesh = new THREE.Mesh(geometry, visMaterial);
        this.visMesh.castShadow = true;
        this.visMesh.userData = this.body;	// for raycasting
        this.visMesh.layers.enable(1);

        geometry.computeVertexNormals();
        this.updateVisMesh();
        
        // start updating position every timestep.
        this.active = true;
        scene.add(this.tetMesh);
        this.tetMesh.visible = false;
        scene.add(this.visMesh);


    }

    initializeAnimation() {

        const times = [0, 3, 6];
        const positionValues = [0, 0, 0, 5, 5, 5, 0, 0, 0];

        const positionKeyFrame = new THREE.VectorKeyframeTrack('.position',times, positionValues)

        const tracks = [positionKeyFrame]

        const clip = new THREE.AnimationClip('move', -1, tracks);

        this.mixer = new THREE.AnimationMixer(this.visMesh);
        const moveAction = this.mixer.clipAction(clip);

       // moveAction.play();
        
    }
    update(delta) {
        /**
         *
         * Method called at every frame
         * run numSubSteps steps of physics simulation
         * and update the object's meshes.
         *
         */
        if (!this.active) return;
        
//        this.mixer.update(physicsConstants.dt);

        if (physicsParameters.paused) return;

        let sdt = physicsConstants.dt / physicsParameters.numSubsteps;
     
        for (let i = 0; i < physicsParameters.numSubsteps; i++) {
            // The ordering might be a problem
            this.body.preSolve(sdt, physicsConstants.gravity);

            this.body.solve(sdt);

            this.body.postSolve(sdt);
        }

        this.updateMeshes();
    }

    updateMeshes() {
        /**
         *
         * Update the display mesh of the object according to the
         * change in internal position (from physics)
         *
         */

        this.updateTetMesh();
        this.updateVisMesh();
    }

    updateTetMesh()
	{
        const positions = this.tetMesh.geometry.attributes.position.array;
        for (let i = 0; i < this.body.pos.length; i++) 
            positions[i] = this.body.pos[i];
        this.tetMesh.geometry.attributes.position.needsUpdate = true;
        this.tetMesh.geometry.computeBoundingSphere();
	}	

    updateVisMesh()
    {
        const positions = this.visMesh.geometry.attributes.position.array;
        var nr = 0;
        for (let i = 0; i < this.body.numVisVerts; i++) {
            var tetNr = this.body.skinningInfo[nr++] * 4;
            if (tetNr < 0) {
                nr += 3;
                continue;
            }
            var b0 = this.body.skinningInfo[nr++];
            var b1 = this.body.skinningInfo[nr++];
            var b2 = this.body.skinningInfo[nr++];
            var b3 = 1.0 - b0 - b1 - b2;
            var id0 = this.body.tetIds[tetNr++];
            var id1 = this.body.tetIds[tetNr++];
            var id2 = this.body.tetIds[tetNr++];
            var id3 = this.body.tetIds[tetNr++];
            FlatMath.vecSetZero(positions,i);
            FlatMath.vecAdd(positions,i, this.body.pos,id0, b0);
            FlatMath.vecAdd(positions,i, this.body.pos,id1, b1);
            FlatMath.vecAdd(positions,i, this.body.pos,id2, b2);
            FlatMath.vecAdd(positions,i, this.body.pos,id3, b3);
        }
        this.visMesh.geometry.computeVertexNormals();
        this.visMesh.geometry.attributes.position.needsUpdate = true;
        this.visMesh.geometry.computeBoundingSphere();
    }			
    
}
