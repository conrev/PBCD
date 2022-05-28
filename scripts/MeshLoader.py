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

    #return int(vertexId),int(vertexTexture),int(vertexNormal)

def build_unique_edges(faces_list, quadMesh=False):
    step = 4 if quadMesh else 3
    
    edges = set()

    for i in range(0,len(faces_list),step):
        subset = sorted(faces_list[i:i+step])
        #print(list(combinations(subset,2)))
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
                    # if the future we need to map textures and vertex normals
            if line[0] == 'f':
                components = line.replace('\n','').split(" ")
                if len(components) == 5:
                    # Quads OBJ
                    result["tetFaceIds"].extend(list(map(extract_faces,components[1:])))
                #elif len(components) == 4:
                    # Tris OBJ
                    #result["triFaceIds"].extend(list(map(extract_faces,components[1:])))
                    #print(v1,v2,v3)
                    #result["triFaceIds"].extend([int(v1),int(v2),int(v3)])
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

    with open(mesh_file) as f:
        contents = f.readlines()
        vertsIndex = vertsCount = 0
        for i, line in enumerate(contents):
            if line.startswith('Vertices'):
                vertsIndex = i
        vertsCount = int(contents[vertsIndex+1])
        print(vertsCount)
        for i in range(vertsCount):
            pass    
        
        triIndex, triCount = 0 





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


