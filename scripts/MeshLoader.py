#/usr/bin/env python3

import itertools
from re import sub
import sys
import json
from itertools import combinations

PATH_PREFIX = "assets/"

def extract_faces(str):
    # format f vertexId0/vertexTexture0/vertexNormal0 vertexId1/vertexTexture1/vertexNormal1 vertexId2/vertexTexture2/vertexNormal2 ..
    vertexId, vertexTexture, vertexNormal = str.split("/")
    return int(vertexId)-1 # OBJ is 1 indexed, Programming Languages are 0 Indexed

def build_unique_edges(faces_list, quadMesh=False):
    step = 4 if quadMesh else 3
    
    edges = set()

    for i in range(0,len(faces_list),step):
        subset = sorted(faces_list[i:i+step])
        edges.update(list(combinations(subset,2)))

    edges = sorted(edges,key=lambda x: (x[0],x[1]))

    return list(itertools.chain(*edges))


def read_OBJ(volumetric_file, surface_file):
    
    result = {
        "vertices" : [],
        "tetFaceIds" : [],
        "edgeList" : [],
        "triFaceIds" : []
    }
    
    with open(volumetric_file) as f:
        contents = f.readlines()
        for line in contents:
            if line[0] == 'v':
                type, x, y, z = line.replace('\n','').split(" ")
                if type == 'v':
                    result["vertices"].extend([float(x),float(y),float(z)])
                else:
                    pass
            if line[0] == 'f':
                components = line.replace('\n','').split(" ")
                if len(components) == 5:
                    result["tetFaceIds"].extend(list(map(extract_faces,components[1:])))
    f.close()
    
    with open(surface_file) as f:
        contents = f.readlines()
        for line in contents:
            if line.startswith('f'):
                components = line.replace('\n','').split(" ")
                if len(components) == 4:
                    # Quads OBJ
                    result["triFaceIds"].extend(list(map(extract_faces,components[1:])))
                else:
                    print(components)
                    raise Exception("The surface mesh does not have triangular faces")

    
    if len(result["tetFaceIds"])>0:
        result["edgeList"] = build_unique_edges(result["tetFaceIds"], True)

    return result;


def read_MESH(mesh_file):
    
    result = {
        "vertices" : [],
        "tetFaceIds" : [],
        "edgeList" : [],
        "triFaceIds" : []
    }

    with open(mesh_file) as f:
        contents = f.readlines()
        vertsIndex = vertsCount = 0
        trisIndex  = trisCount = 0
        tetsIndex = tetsCount = 0

        for i, line in enumerate(contents):
            if line.startswith('Vertices'):
                vertsIndex = i
            if line.startswith('Triangles'):
                trisIndex = i
            if line.startswith('Tetrahedra'):
                tetsIndex = i
        
        vertsCount = int(contents[vertsIndex+1])
        for i in range(1,vertsCount+1):
            x, y, z, _ = contents[vertsIndex+1+i].replace('\n','').split(" ")
            result["vertices"].extend([float(x),float(y) + 6.0,float(z)])

        trisCount = int(contents[trisIndex+1])
        for i in range(1,trisCount+1):
            line = contents[trisIndex+1+i].replace('\n','').split(" ")[:3]
            result["triFaceIds"].extend(map(lambda x: int(x) - 1,line)) # 0 indexed faces

        tetsCount = int(contents[tetsIndex+1])
        for i in range(1,tetsCount+1):
            line = contents[tetsIndex+1+i].replace('\n','').split(" ")[:4]
            result["tetFaceIds"].extend(map(lambda x: int(x) - 1,line)) # 0 indexed faces

    if len(result["triFaceIds"])>0:
        result["edgeList"] = build_unique_edges(result["triFaceIds"], False)

    return result;

if __name__ == "__main__":
    result = {}
    
    if len(sys.argv) <= 1:
        sys.exit("This script requires at least one argument, the path to the Mesh File")
    
    if sys.argv[1].endswith('.obj'):
        result = read_OBJ(sys.argv[1],sys.argv[2])
    elif sys.argv[1].endswith('.mesh'):
        result = read_MESH(sys.argv[1])

    with open(f'{sys.argv[1]}.json', 'w') as f:
        json.dump(result, f)


