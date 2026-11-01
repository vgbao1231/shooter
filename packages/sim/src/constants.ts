export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;

export const GRAVITY = 1900;
export const GROUND_ACCEL = 16;
export const AIR_ACCEL = 5;
export const MOVE_SPEED = 320;
export const JUMP_SPEED = 840;
export const WALL_JUMP_SPEED_X = 440;
export const WALL_JUMP_SPEED_Y = 720;
export const WALL_CLIMB_SPEED = 170;
export const WALL_SLIDE_SPEED = 110;
export const CLIMB_STAMINA_MAX = 1;
export const CLIMB_STAMINA_DRAIN = 1.35;
export const CLIMB_STAMINA_REGEN = 2.4;

export const PLAYER_RADIUS = 20;
export const PLAYER_MAX_HEALTH = 100;

export const GRENADE_FUSE = 1.7;
export const GRENADE_RADIUS = 135; // blast radius (world units)
export const GRENADE_BODY_RADIUS = 14; // physical/visual body radius
export const GRENADE_DAMAGE = 45;
export const GRENADE_COOLDOWN = 1.2;
export const FRAG_GRENADE_COOLDOWN = 0.5;

export const PARTICLE_CAP = 500;
export const HIT_STOP_HURT = 0.04;
export const HIT_STOP_BOOM = 0.05;
export const SANDBOX_RESET_DELAY = 2.2;
export const ROUND_COUNTDOWN = 1.6;
export const ROUND_END_DELAY = 1.9;

export const PLAYER_COLORS = ["#4da3ff", "#ff9b3d", "#8be04e", "#c78bff"] as const;