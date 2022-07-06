import * as Vector3 from "../utils/VectorOperations.js";

export class DeformableBody {
    constructor(
        tetMesh,
        edgeCompliance = 50.0,
        volCompliance = 0.0,
        dampingFactor = 1.0
    ) {
        /**
         * Create a deformable body instance
         *
         * @param {JSON} tetMesh tetrahedral mesh representation of this body
         * @param {number} edgeCompliance compliance factor of the distance constraint
         * @param {number} volCompliance compliance factor of the volume constraint
         * @param {number} dampingFactor scaling factor of the body at every tiemstep
         *
         */
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
        this.dampingFactor = dampingFactor;

        this.temp = new Float32Array(4 * 3);
        this.grads = new Float32Array(4 * 3);

        this.grabId = -1;
        this.grabInvMass = 0.0;

        this.volIdOrder = [
            [1, 3, 2],
            [0, 2, 3],
            [0, 3, 1],
            [0, 1, 2],
        ];

        this.initPhysics();
    }

    translate(x, y, z) {
        /**
         * Translate this body by (x,y,z)
         *
         * @param {number} x changes in x axis direction
         * @param {number} y changes in y axis direction
         * @param {number} z changes in z axis direction
         *
         */
        for (var i = 0; i < this.numParticles; i++) {
            Vector3.vecAdd(this.pos, i, [x, y, z], 0);
            Vector3.vecAdd(this.prevPos, i, [x, y, z], 0);
        }
    }

    getTetVolume(nr) {
        /**
         * Get the volume of a tetrahedra with index "nr"
         *
         * @param {number} nr index of the desired tetrahedra
         *
         */

        var id0 = this.tetIds[4 * nr];
        var id1 = this.tetIds[4 * nr + 1];
        var id2 = this.tetIds[4 * nr + 2];
        var id3 = this.tetIds[4 * nr + 3];
        Vector3.vecSetDiff(this.temp, 0, this.pos, id1, this.pos, id0);
        Vector3.vecSetDiff(this.temp, 1, this.pos, id2, this.pos, id0);
        Vector3.vecSetDiff(this.temp, 2, this.pos, id3, this.pos, id0);
        Vector3.vecSetCross(this.temp, 3, this.temp, 0, this.temp, 1);
        return Vector3.vecDot(this.temp, 3, this.temp, 2) / 6.0;
    }

    initPhysics() {
        /**
         * Initialize class member variables for the purpose of physics computation
         * Including : - Precompute resting volume
         *             - Precompute resting edge length
         *             - Initialize mass matrix for all points
         *
         */

        this.invMass.fill(0.0);
        this.restVol.fill(0.0);

        for (var i = 0; i < this.numTets; i++) {
            var vol = this.getTetVolume(i);
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
            this.edgeLengths[i] = Math.sqrt(
                Vector3.vecDistSquared(this.pos, id0, this.pos, id1)
            );
        }
    }

    preSolve(dt, gravity) {
        /**
         * Update the state of the object using forward euler
         * (predicted position).
         *
         * @param {number} dt timestep size (in secs)
         * @param {Array} gravity 3-sized array representing gravity applied to the object
         *
         */

        for (var i = 0; i < this.numParticles; i++) {
            if (this.invMass[i] == 0.0) continue;
            Vector3.vecAdd(this.vel, i, gravity, 0, dt);
            Vector3.vecCopy(this.prevPos, i, this.pos, i);
            Vector3.vecAdd(this.pos, i, this.vel, i, dt);
            var y = this.pos[3 * i + 1];
            if (y < 0.0) {
                Vector3.vecCopy(this.pos, i, this.prevPos, i);
                this.pos[3 * i + 1] = 0.0;
            }
        }
    }

    solve(dt) {
        /**
         * Using position based dynamics update,
         * Move the object according the direction that minimizes
         * the constraint function (make it zero).
         * This creates the effect of "soft" body that tries to
         * satisfy edge and volume constraint.
         *
         * @param {number} dt timestep size (in secs)
         *
         */

        this.solveEdges(this.edgeCompliance, dt);
        this.solveVolumes(this.volCompliance, dt);
    }

    postSolve(dt) {
        /**
         * Calculate the current velocity of the object
         * based on the immediate position change after applying
         * distance and volume constraint.
         *
         * this velocity will be applied to the object next timestep
         * if there are no forces applied (inertial velocity)
         *
         * @param {number} dt timestep size (in secs)
         *
         */

        for (var i = 0; i < this.numParticles; i++) {
            if (this.invMass[i] == 0.0) continue;
            Vector3.vecSetDiff(
                this.vel,
                i,
                this.pos,
                i,
                this.prevPos,
                i,
                this.dampingFactor / dt
            );
        }
    }

    solveEdges(compliance, dt) {
        /**
         * Calculate the change in position according to
         * the distance constraint.
         *
         *
         * Distance constraint tries to maintain the distance
         * between two edges. for every timestep,the distance
         * between two edges |x_1 - x_2| is computed, and compared to
         * the resting distance R_d (initial distance).
         *
         * We then try to minimize C = |x_1 - x_2| - R_d
         * by moving a point towards / away from each other
         * scaled by a scalar factor to conserve linear and angular momenta
         *
         * @param {number} dt timestep size (in secs)
         * @param {number} compliance how strict we will be at following this constraint
         *
         */

        var alpha = compliance / dt / dt;

        for (var i = 0; i < this.edgeLengths.length; i++) {
            var id0 = this.edgeIds[2 * i];
            var id1 = this.edgeIds[2 * i + 1];
            var w0 = this.invMass[id0];
            var w1 = this.invMass[id1];
            var w = w0 + w1;
            if (w == 0.0) continue;

            Vector3.vecSetDiff(this.grads, 0, this.pos, id0, this.pos, id1);
            var len = Math.sqrt(Vector3.vecLengthSquared(this.grads, 0));
            if (len == 0.0) continue;
            Vector3.vecScale(this.grads, 0, 1.0 / len);
            var restLen = this.edgeLengths[i];
            var C = len - restLen;
            var s = -C / (w + alpha);
            Vector3.vecAdd(this.pos, id0, this.grads, 0, s * w0);
            Vector3.vecAdd(this.pos, id1, this.grads, 0, -s * w1);
        }
    }

    solveVolumes(compliance, dt) {
        /**
         * Calculate the change in position according to
         * the volume constraint.
         *
         *
         * Distance constraint tries to maintain the volume
         * of all tetrahedra inside the object.
         * Similar to distance constraint, we compare the current volume
         * to the resting volume of each tetrahedron.
         *
         * reminder : volume of a tetrahedron can be computed
         *  V = 1/6 (X_1 cross X_2) dot X_3
         * where X_1, X_2 are vectors that made up tetrahedron base
         * and X_3 are vectors that points from base to the peak of the tetrahedra
         *
         * @param {number} dt timestep size (in secs)
         * @param {number} compliance how strict we will be at following this constraint
         *
         */

        var alpha = compliance / dt / dt;

        for (var i = 0; i < this.numTets; i++) {
            var w = 0.0;

            for (var j = 0; j < 4; j++) {
                var id0 = this.tetIds[4 * i + this.volIdOrder[j][0]];
                var id1 = this.tetIds[4 * i + this.volIdOrder[j][1]];
                var id2 = this.tetIds[4 * i + this.volIdOrder[j][2]];

                Vector3.vecSetDiff(this.temp, 0, this.pos, id1, this.pos, id0);
                Vector3.vecSetDiff(this.temp, 1, this.pos, id2, this.pos, id0);
                Vector3.vecSetCross(this.grads, j, this.temp, 0, this.temp, 1);
                Vector3.vecScale(this.grads, j, 1.0 / 6.0);

                w +=
                    this.invMass[this.tetIds[4 * i + j]] *
                    Vector3.vecLengthSquared(this.grads, j);
            }
            if (w == 0.0) continue;

            var vol = this.getTetVolume(i);
            var restVol = this.restVol[i];
            var C = vol - restVol;
            var s = -C / (w + alpha);

            for (var j = 0; j < 4; j++) {
                var id = this.tetIds[4 * i + j];
                Vector3.vecAdd(
                    this.pos,
                    id,
                    this.grads,
                    j,
                    s * this.invMass[id]
                );
            }
        }
    }

    startGrab(pos) {
        /**
         * Handler function to handle a start of a "grab"
         * action. Called by the grabber class.
         *
         * the idea is to select the closest vertex
         * to the grabber and assign infinite mass to it
         *
         * since object with infinite mass do not get
         * affected by simulation, grabber has full control
         * over its movement
         *
         * @param {Array} pos 3-sized array representing position
         *                    of the grabber object.
         *
         */

        var p = [pos.x, pos.y, pos.z];
        var minD2 = Number.MAX_VALUE;
        this.grabId = -1;
        for (let i = 0; i < this.numParticles; i++) {
            var d2 = Vector3.vecDistSquared(p, 0, this.pos, i);
            if (d2 < minD2) {
                minD2 = d2;
                this.grabId = i;
            }
        }

        if (this.grabId >= 0) {
            this.grabInvMass = this.invMass[this.grabId];
            this.invMass[this.grabId] = 0.0;
            Vector3.vecCopy(this.pos, this.grabId, p, 0);
        }
    }

    moveGrabbed(pos) {
        /**
         * Handler function to move a grabbed vertex
         *
         * just set the position to the desired position
         *
         * @param {Array} pos desired pos of the grabbed vertex
         *
         */

        if (this.grabId >= 0) {
            var p = [pos.x, pos.y, pos.z];
            Vector3.vecCopy(this.pos, this.grabId, p, 0);
        }
    }

    endGrab(vel) {
        /**
         * Handler function to release a grabbed vertex
         *
         * reverse the mass assignment of grabbing, allowing
         * the object to be affected by simulation once again
         *
         * velocity is passed because we want the vertex to maintain its previous
         * velocity ("momentum") that came from it being grabbed around
         *
         * @param {Array} vel inertial velocity from the grabbing process
         *
         */

        if (this.grabId >= 0) {
            this.invMass[this.grabId] = this.grabInvMass;
            var v = [vel.x, vel.y, vel.z];
            Vector3.vecCopy(this.vel, this.grabId, v, 0);
        }
        this.grabId = -1;
    }
}
