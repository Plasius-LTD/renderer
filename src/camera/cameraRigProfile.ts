export interface CameraRigProfile {
  orbitSpeed: number;
  panSpeed: number;
  dollySpeed: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

export const VIEW_PROFILE: CameraRigProfile = {
  orbitSpeed: 0.0085,
  panSpeed: 0.0018,
  dollySpeed: 0.0012,
  minDistance: 1.0,
  maxDistance: 200,
  minPolarAngle: (12 * Math.PI) / 180,
  maxPolarAngle: (150 * Math.PI) / 180,
};

export const EDIT_PROFILE: CameraRigProfile = {
  orbitSpeed: 0.01,
  panSpeed: 0.0022,
  dollySpeed: 0.0012,
  minDistance: 5.0,
  maxDistance: 200,
  minPolarAngle: 0,
  maxPolarAngle: (15 * Math.PI) / 32,
};
