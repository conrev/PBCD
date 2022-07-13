export const physicsConstants  = {
    gravity : [0.0, -10.0, 0.0],
    dt : 1.0 / 60.0,
}

export const sandboxAssets = { 
    'Suzanne' : 'assets/SuzanneTet.obj.json',
    'Ortiz' : 'assets/OrtizTet.obj.json',
    'Spot' : 'assets/SpotTet.obj.json',
    'Fox' : 'assets/FoxTet.obj.json'
}

export let physicsParameters = {
    paused : false,
    numSubsteps : 5
}