import * as THREE from 'three'
import * as Vector3 from '../utils/VectorOperations.js'

export class DeformableObject {

     notNaN(element, index, array) {
        return !isNaN(element);
      }

	constructor(tetMesh, scene, edgeCompliance = 50.0, volCompliance = 0.0)
    {
        // physics

        this.numParticles = tetMesh.vertices.length / 3;
        this.numTets = tetMesh.tetFaceIds.length / 4;
        this.pos = new Float32Array(tetMesh.vertices);

        this.prevPos = tetMesh.vertices.slice();
        this.vel = new Float32Array(3 * this.numParticles);

        this.tetIds = tetMesh.tetFaceIds;
        this.edgeIds = tetMesh.edgeList;
        this.restVol = new Float32Array(this.numTets);
        this.edgeLengths = new Float32Array(this.edgeIds.length / 2);	
        this.triIds = tetMesh.triFaceIds;

        this.invMass = new Float32Array(this.numParticles);

        this.edgeCompliance = edgeCompliance;
        this.volCompliance = volCompliance;

        this.temp = new Float32Array(4 * 3);
        this.grads = new Float32Array(4 * 3);

        this.grabId = -1;
        this.grabInvMass = 0.0;

        this.initPhysics();
        this.createDisplayMesh(scene);

        this.volIdOrder = [[1,3,2], [0,2,3], [0,3,1], [0,1,2]];
                    
    }

    createDisplayMesh(scene){
                // surface tri mesh
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geometry.setIndex(this.triIds);
        var material = new THREE.MeshPhongMaterial({color: 0xF02000});
        material.flatShading = true;
        this.surfaceMesh = new THREE.Mesh(geometry, material);
        this.surfaceMesh.geometry.computeVertexNormals();
        this.surfaceMesh.userData = this;
        this.surfaceMesh.layers.enable(1);
        scene.add(this.surfaceMesh);
    }

    translate(x, y, z)
    {
        for (var i = 0; i < this.numParticles; i++) {
            Vector3.vecAdd(this.pos,i, [x,y,z],0);
            Vector3.vecAdd(this.prevPos,i, [x,y,z],0);
        }
    }

    updateMeshes() 
    {
        this.surfaceMesh.geometry.computeVertexNormals();
        this.surfaceMesh.geometry.attributes.position.needsUpdate = true;
        this.surfaceMesh.geometry.computeBoundingSphere();									
    }

    getTetVolume(nr) 
    {
        var id0 = this.tetIds[4 * nr];
        var id1 = this.tetIds[4 * nr + 1];
        var id2 = this.tetIds[4 * nr + 2];
        var id3 = this.tetIds[4 * nr + 3];
        Vector3.vecSetDiff(this.temp,0, this.pos,id1, this.pos,id0);
        Vector3.vecSetDiff(this.temp,1, this.pos,id2, this.pos,id0);
        Vector3.vecSetDiff(this.temp,2, this.pos,id3, this.pos,id0);
        Vector3.vecSetCross(this.temp,3, this.temp,0, this.temp,1);
        return Vector3.vecDot(this.temp,3, this.temp,2) / 6.0;
    }

    initPhysics() 
    {

        this.invMass.fill(0.0);
        this.restVol.fill(0.0);

        for (var i = 0; i < this.numTets; i++) {
            var vol =this.getTetVolume(i);
            this.restVol[i] = vol;
            var pInvMass = vol > 0.0 ? 1.0 / (vol / 4.0) : 0.0;
            this.invMass[this.tetIds[4 * i]] += pInvMass;
            this.invMass[this.tetIds[4 * i + 1]] += pInvMass;
            this.invMass[this.tetIds[4 * i + 2]] += pInvMass;
            this.invMass[this.tetIds[4 * i + 3]] += pInvMass;
        }
        for (var i = 0; i < this.edgeLengths.length; i++) {
            var id0 = this.edgeIds[2 * i];
            var id1 = this.edgeIds[2 * i + 1];
            this.edgeLengths[i] = Math.sqrt(Vector3.vecDistSquared(this.pos,id0, this.pos,id1));
        }
    }

    preSolve(dt, gravity)
    {
        for (var i = 0; i < this.numParticles; i++) {
            if (this.invMass[i] == 0.0)
                continue;
            Vector3.vecAdd(this.vel,i, gravity,0, dt);
            Vector3.vecCopy(this.prevPos,i, this.pos,i);
            Vector3.vecAdd(this.pos,i, this.vel,i, dt);
            var y = this.pos[3 * i + 1];
            if (y < 0.0) {
                Vector3.vecCopy(this.pos,i, this.prevPos,i);
                this.pos[3 * i + 1] = 0.0;
            }
        }
    }

    solve(dt)
    {
        this.solveEdges(this.edgeCompliance, dt);
        this.solveVolumes(this.volCompliance, dt);
    }

    postSolve(dt)
    {
        for (var i = 0; i < this.numParticles; i++) {
            if (this.invMass[i] == 0.0)
                continue;
            Vector3.vecSetDiff(this.vel,i, this.pos,i, this.prevPos,i, 0.995 / dt);
        }
        this.updateMeshes();
    }

    solveEdges(compliance, dt) {
        var alpha = compliance / dt /dt;

        for (var i = 0; i < this.edgeLengths.length; i++) {
            var id0 = this.edgeIds[2 * i];
            var id1 = this.edgeIds[2 * i + 1];
            var w0 = this.invMass[id0];
            var w1 = this.invMass[id1];
            var w = w0 + w1;
            if (w == 0.0)
                continue;

            Vector3.vecSetDiff(this.grads,0, this.pos,id0, this.pos,id1);
            var len = Math.sqrt(Vector3.vecLengthSquared(this.grads,0));
            if (len == 0.0)
                continue;
            Vector3.vecScale(this.grads,0, 1.0 / len);
            var restLen = this.edgeLengths[i];
            var C = len - restLen;
            var s = -C / (w + alpha);
            Vector3.vecAdd(this.pos,id0, this.grads,0, s * w0);
            Vector3.vecAdd(this.pos,id1, this.grads,0, -s * w1);
        }
    }

    solveVolumes(compliance, dt) {
        var alpha = compliance / dt /dt;

        for (var i = 0; i < this.numTets; i++) {
            var w = 0.0;
            
            for (var j = 0; j < 4; j++) {
                var id0 = this.tetIds[4 * i + this.volIdOrder[j][0]];
                var id1 = this.tetIds[4 * i + this.volIdOrder[j][1]];
                var id2 = this.tetIds[4 * i + this.volIdOrder[j][2]];

                Vector3.vecSetDiff(this.temp,0, this.pos,id1, this.pos,id0);
                Vector3.vecSetDiff(this.temp,1, this.pos,id2, this.pos,id0);
                Vector3.vecSetCross(this.grads,j, this.temp,0, this.temp,1);
                Vector3.vecScale(this.grads,j, 1.0/6.0);

                w += this.invMass[this.tetIds[4 * i + j]] * Vector3.vecLengthSquared(this.grads,j);
            }
            if (w == 0.0)
                continue;

            var vol = this.getTetVolume(i);
            var restVol = this.restVol[i];
            var C = vol - restVol;
            var s = -C / (w + alpha);

            for (var j = 0; j < 4; j++) {
                var id = this.tetIds[4 * i + j];
                Vector3.vecAdd(this.pos,id, this.grads,j, s * this.invMass[id])
            }
        }
    }

    squash() {
        for (var i = 0; i < this.numParticles; i++) {
            this.pos[3 * i + 1] = 0.5;
        }
        this.updateMeshes();
    }

    startGrab(pos) 
    {
        var p = [pos.x, pos.y, pos.z];
        var minD2 = Number.MAX_VALUE;
        this.grabId = -1;
        for (let i = 0; i < this.numParticles; i++) {
            var d2 = Vector3.vecDistSquared(p,0, this.pos,i);
            if (d2 < minD2) {
                minD2 = d2;
                this.grabId = i;
            }
        }

        if (this.grabId >= 0) {
            this.grabInvMass = this.invMass[this.grabId];
            this.invMass[this.grabId] = 0.0;
            Vector3.vecCopy(this.pos,this.grabId, p,0);	
        }
    }

    moveGrabbed(pos, vel) 
    {
        if (this.grabId >= 0) {
            var p = [pos.x, pos.y, pos.z];
            Vector3.vecCopy(this.pos,this.grabId, p,0);
        }
    }

    endGrab(pos, vel) 
    {
        if (this.grabId >= 0) {
            this.invMass[this.grabId] = this.grabInvMass;
            var v = [vel.x, vel.y, vel.z];
            Vector3.vecCopy(this.vel,this.grabId, v,0);
        }
        this.grabId = -1;
    }								
}

