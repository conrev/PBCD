import * as THREE from 'three'
import { DeformableObject } from './DeformableObject';
import * as Vector3 from '../utils/VectorOperations.js'

export class CylinderObject extends DeformableObject {

    createDisplayMesh(scene){
        const segmentHeight = 0.5;
        const segmentCount = 8;
        const height = segmentHeight * segmentCount;
        const halfHeight = height * 0.5;

        const sizing = {
            segmentHeight: segmentHeight,
            segmentCount: segmentCount,
            height: height,
            halfHeight: halfHeight
        };

        const geometry = this.createGeometry( sizing );
        const bones = this.createBones( sizing );
        const mesh = this.createMesh( geometry, bones, scene);

        mesh.scale.multiplyScalar( 1 );
        this.surfaceMesh = mesh;
        this.bones = mesh.skeleton.bones;
        this.surfaceMesh.geometry.computeVertexNormals();
        this.surfaceMesh.userData = this;
        this.surfaceMesh.layers.enable(1);
        this.surfaceMesh.helper =  new THREE.SkeletonHelper( mesh );
        this.surfaceMesh.helper.material.linewidth = 2;
        this.hasAnimation = true;

        scene.add(this.surfaceMesh.helper);

        scene.add( this.surfaceMesh );

        this.setupBoneConstraint(scene);

    }

    createGeometry( sizing ) {
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geometry.setIndex(this.triIds);

        const position = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        const skinIndices = [];
        const skinWeights = [];

        for ( let i = 0; i < position.count; i ++ ) {
            
            vertex.fromBufferAttribute( position, i );

            const y = ( vertex.y);

            const skinIndex = Math.floor( y / sizing.segmentHeight );
            const skinWeight = ( y % sizing.segmentHeight ) / sizing.segmentHeight;

            skinIndices.push( skinIndex, skinIndex + 1, 0, 0 );
            skinWeights.push( 1 - skinWeight, skinWeight, 0, 0 );

        }

        geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
        geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );

        return geometry;

    }

    createBones( sizing ) {

        let bones = [];

        let prevBone = new THREE.Bone();
        bones.push( prevBone );
        prevBone.position.y = 0;

        for ( let i = 0; i < sizing.segmentCount; i ++ ) {

            const bone = new THREE.Bone();
            bone.position.y = sizing.segmentHeight;
            bones.push( bone );
            prevBone.add( bone );
            prevBone = bone;

        }

        return bones;

    }

    createMesh( geometry, bones, scene) {

        const material = new THREE.MeshPhongMaterial( {
            color: 0x156289,
            emissive: 0x072534,
            side: THREE.DoubleSide,
            flatShading: true
        } );

        const mesh = new THREE.SkinnedMesh( geometry,	material );
        const skeleton = new THREE.Skeleton( bones );

        mesh.add( bones[ 0 ] );

        mesh.bind( skeleton );

        return mesh;

    }

    animateBones(){

        const time = Date.now() * 0.005;

        for ( let i = 0; i < this.surfaceMesh.skeleton.bones.length; i ++ ) {
       
            this.surfaceMesh.skeleton.bones[ i ].rotation.z = Math.sin( time ) * 2 / this.surfaceMesh.skeleton.bones.length;

        }

        
       
    }

    computeBoneProjection(pointId, boneId) {

        const boneVector = new THREE.Vector3();
        const parentBoneVector = new THREE.Vector3();
        const particleVec = new THREE.Vector3();
        const startToParticleVec = new THREE.Vector3();

        particleVec.fromBufferAttribute(this.surfaceMesh.geometry.attributes.position,pointId);

        boneVector.setFromMatrixPosition(this.bones[boneId].matrixWorld);
        parentBoneVector.setFromMatrixPosition(this.bones[boneId].parent.matrixWorld);

        startToParticleVec.subVectors(particleVec,parentBoneVector);
        boneVector.sub(parentBoneVector);

        let projection = startToParticleVec.projectOnVector(boneVector);

        if (projection.dot(boneVector) <0)
            projection = parentBoneVector;  // clamp to start point
        else if (projection.length() > boneVector.length())
            projection = boneVector.add(parentBoneVector); // clamp to end point
        else 
            projection.add(parentBoneVector);     // projection is between a and b


            // console.log(this.surfaceMesh.geometry.attributes.position.array[i*3]+","+this.surfaceMesh.geometry.attributes.position.array[i*3+1]+","+this.surfaceMesh.geometry.attributes.position.array[i*3+2])
        return new Float32Array([projection.x, projection.y, projection.z]);


    }

    setupBoneConstraint(scene) {

        scene.updateMatrixWorld();
        
        this.closestBoneDistance = new Float32Array(this.numParticles);
        this.closestBone = new Float32Array(this.numParticles);

        for(let i=0; i<this.numParticles;i++){
            
            let minDist = Number.MAX_VALUE;
            let boneIdx = 0;

            for(let j=1; j<this.bones.length; j++) {
                
                const projection = this.computeBoneProjection(i, j)
                //console.log(projection);

                const dist = Vector3.vecDistSquared(projection,0,this.pos,i);
                //const dist = projection.distanceTo(particleVec);
                //console.log(dist);


                if(dist == 0)
                    console.log(projection, i, particleVec);

                if (dist < minDist){
                    minDist = dist;
                    boneIdx = j;
                }
            }

            this.closestBoneDistance[i] = minDist;
            this.closestBone[i] = boneIdx;
        
        }
    }
    
    solveBinding(compliance, dt){
        var alpha = compliance / dt /dt;
        
        for (let i = 0; i< this.numParticles;i ++) {
            let w = this.invMass[i];

            if (w == 0.0)
                continue;
            
            let closestBone = this.closestBone[i];
            let restLen = this.closestBoneDistance[i];
            
            let projection = this.computeBoneProjection(i, closestBone);

            //console.log(projection);
            Vector3.vecSetDiff(this.grads, 0, this.pos, i, projection, 0);

            let len = Math.sqrt(Vector3.vecLengthSquared(this.grads,0));

            Vector3.vecScale(this.grads,0, 1.0 / len);

            if (len == 0.0)
                continue;
            let C = len - restLen;
            let s = -C / (alpha);
            //console.log(this.grads);

            //console.log(this.grads);
            Vector3.vecAdd(this.pos,i, this.grads,0, s);    
        }
        //compute form all bones to all points;
        //find the closest bone;
        //mark /store it;
        //recompute at every timestep
        //run distance constraint
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

    solve(dt)
    {

        this.solveBinding(this.edgeCompliance, dt);
        this.solveEdges(this.edgeCompliance, dt);
        this.solveVolumes(this.volCompliance, dt);
    }


}