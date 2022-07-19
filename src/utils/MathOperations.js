// ----- math on vector arrays -------------------------------------------------------------

export function vecSetZero(a,anr) {
    anr *= 3;
    a[anr++] = 0.0;
    a[anr++] = 0.0;
    a[anr]   = 0.0;
}

export function vecScale(a,anr, scale) {
    anr *= 3;
    a[anr++] *= scale;
    a[anr++] *= scale;
    a[anr]   *= scale;
}

export function vecCopy(a,anr, b,bnr) {
    anr *= 3; bnr *= 3;
    a[anr++] = b[bnr++]; 
    a[anr++] = b[bnr++]; 
    a[anr]   = b[bnr];
}

export function vecAdd(a,anr, b,bnr, scale = 1.0) {
    anr *= 3; bnr *= 3;
    a[anr++] += b[bnr++] * scale; 
    a[anr++] += b[bnr++] * scale; 
    a[anr]   += b[bnr] * scale;
}

export function vecSetDiff(dst,dnr, a,anr, b,bnr, scale = 1.0) {
    dnr *= 3; anr *= 3; bnr *= 3;
    dst[dnr++] = (a[anr++] - b[bnr++]) * scale;
    dst[dnr++] = (a[anr++] - b[bnr++]) * scale;
    dst[dnr]   = (a[anr] - b[bnr]) * scale; 
}

export function vecLengthSquared(a,anr) {
    anr *= 3;
    let a0 = a[anr], a1 = a[anr + 1], a2 = a[anr + 2];
    return a0 * a0 + a1 * a1 + a2 * a2;
}

export function vecDistSquared(a,anr, b,bnr) {
    anr *= 3; bnr *= 3;
    let a0 = a[anr] - b[bnr], a1 = a[anr + 1] - b[bnr + 1], a2 = a[anr + 2] - b[bnr + 2];
    return a0 * a0 + a1 * a1 + a2 * a2;
}	

export function vecDot(a,anr, b,bnr) {
    anr *= 3; bnr *= 3;
    return a[anr] * b[bnr] + a[anr + 1] * b[bnr + 1] + a[anr + 2] * b[bnr + 2];
}	

export function vecSetCross(a,anr, b,bnr, c,cnr) {
    anr *= 3; bnr *= 3; cnr *= 3;
    a[anr++] = b[bnr + 1] * c[cnr + 2] - b[bnr + 2] * c[cnr + 1];
    a[anr++] = b[bnr + 2] * c[cnr + 0] - b[bnr + 0] * c[cnr + 2];
    a[anr]   = b[bnr + 0] * c[cnr + 1] - b[bnr + 1] * c[cnr + 0];
}			

export function matGetDeterminant(A) {
    let a11 = A[0], a12 = A[3], a13 = A[6];
    let a21 = A[1], a22 = A[4], a23 = A[7];
    let a31 = A[2], a32 = A[5], a33 = A[8];
    return a11*a22*a33 + a12*a23*a31 + a13*a21*a32 - a13*a22*a31 - a12*a21*a33 - a11*a23*a32;
}

export function matSetMult(A, a,anr, b,bnr) {
    bnr *= 3;
    var bx = b[bnr++];
    var by = b[bnr++];
    var bz = b[bnr];
    vecSetZero(a,anr);
    vecAdd(a,anr, A,0, bx);
    vecAdd(a,anr, A,1, by);
    vecAdd(a,anr, A,2, bz);
}

export function matSetInverse(A) {
    let det = matGetDeterminant(A);
    if (det == 0.0) {
        for (let i = 0; i < 9; i++)
            A[anr + i] = 0.0;
            return;
    }
    let invDet = 1.0 / det;
    let a11 = A[0], a12 = A[3], a13 = A[6];
    let a21 = A[1], a22 = A[4], a23 = A[7];
    let a31 = A[2], a32 = A[5], a33 = A[8]
    A[0] =  (a22 * a33 - a23 * a32) * invDet; 
    A[3] = -(a12 * a33 - a13 * a32) * invDet;
    A[6] =  (a12 * a23 - a13 * a22) * invDet;
    A[1] = -(a21 * a33 - a23 * a31) * invDet;
    A[4] =  (a11 * a33 - a13 * a31) * invDet;
    A[7] = -(a11 * a23 - a13 * a21) * invDet;
    A[2] =  (a21 * a32 - a22 * a31) * invDet;
    A[5] = -(a11 * a32 - a12 * a31) * invDet;
    A[8] =  (a11 * a22 - a12 * a21) * invDet;
}