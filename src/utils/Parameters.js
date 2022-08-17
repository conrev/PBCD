export const physicsConstants = {
	dt: 1.0 / 60.0,
};

export const sandboxAssets = {
	Dragon: "assets/Dragon.obj.json",
	Suzanne: "assets/SuzanneTet.obj.json",
};

export let physicsParameters = {
	paused: false,
	numSubsteps: 5,
	gravity: [0.0, -10.0, 0.0],
	dampingFactor: 0.995,
};
