import * as THREE from "three";
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
        geometry.setIndex(this.body.triIds);

        var material = new THREE.MeshPhongMaterial({ color: 0xf02000 });
        material.flatShading = true;
        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.surfaceMesh.castShadow = true;
        this.surfaceMesh.geometry.computeVertexNormals();
        this.surfaceMesh.userData = this.body;
        this.surfaceMesh.layers.enable(1);

        // start updating position every timestep.
        this.active = true;

        scene.add(this.surfaceMesh);
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

        this.surfaceMesh.geometry.computeVertexNormals();
        this.surfaceMesh.geometry.attributes.position.needsUpdate = true;
        this.surfaceMesh.geometry.computeBoundingSphere();
    }
}
