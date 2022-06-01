import * as THREE from 'three'
import { DeformableObject } from './DeformableObject';
import * as Vector3 from '../utils/VectorOperations.js'
import { MeshDistanceMaterial } from 'three';

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
        this.surfaceMesh = mesh
        this.surfaceMesh.geometry.computeVertexNormals();
        this.surfaceMesh.userData = this;
        this.surfaceMesh.layers.enable(1);
        this.surfaceMesh.helper =  new THREE.SkeletonHelper( mesh );
        this.surfaceMesh.helper.material.linewidth = 2;


        scene.add(this.surfaceMesh.helper);

        scene.add( this.surfaceMesh );

      //  this.getBoneDistance();

    }

    createGeometry( sizing ) {
        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geometry.setIndex(this.triIds);

        //geometry.translate(0,16,0);

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
        prevBone.position.y = 0; //- sizing.halfHeight;

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
        const time = Date.now() * 0.001;
        console.log(this.surfaceMesh.skeleton);
        for ( let i = 0; i < this.surfaceMesh.skeleton.bones.length; i ++ ) {
       
            this.surfaceMesh.skeleton.bones[ i ].rotation.z = Math.sin( time ) * 3 / this.surfaceMesh.skeleton.bones.length;

        }
    }

    getBoneDistance(){

        
        const pointTransform = new Float32Array([0.5,0,0]);
        const boneTransform = new Float32Array([0,0.5,0,0,0,0])
        console.log(this.temp);
        
        for(let i=0; i<1;i++){
           for(let j=0; j<2; j+=2) {
            Vector3.vecSetDiff(this.temp, 0, boneTransform, j, boneTransform, j+1, 1.0);
            Vector3.vecSetDiff(this.temp, 1, pointTransform, i, boneTransform, j, 1.0);      
           
            let cross = new Float32Array(3);
            Vector3.vecSetCross(cross, 0, this.temp, 0, this.temp, 1);
            
            let len = Math.sqrt(Vector3.vecLengthSquared(cross, 0));
            let base = Math.sqrt(Vector3.vecLengthSquared(this.temp, 0));
            console.log(len);
            console.log(len/base);
        }
        
        }
            
    }
    
    bendingConstraint(){

        //compute form all bones to all points;
        //find the closest bone;
        //mark /store it;
        //recompute at every timestep
        //run distance constraint
    }


}