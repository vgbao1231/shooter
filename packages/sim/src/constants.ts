export const TICK_RATE = 60;
export const FIXED_DT = 1 / TICK_RATE;

export const GRAVITY = 1900;
export const GROUND_ACCEL = 34;
export const AIR_ACCEL = 16;
/** Deceleration applied when there's no horizontal input, so the character
 *  stops crisply instead of sliding on momentum (that inertia was the "hard
 *  to control" complaint). Higher than the matching accel. */
export const GROUND_FRICTION = 44;
export const AIR_FRICTION = 24;
export const MOVE_SPEED = 320;
export const JUMP_SPEED = 840;
export const WALL_JUMP_SPEED_X = 440;
export const WALL_JUMP_SPEED_Y = 720;
export const WALL_CLIMB_SPEED = 170;
export const WALL_SLIDE_SPEED = 110;
export const CLIMB_STAMINA_MAX = 1;
export const CLIMB_STAMINA_DRAIN = 1.35;
export const CLIMB_STAMINA_REGEN = 2.4;

export const PLAYER_RADIUS = 16;
export const PLAYER_MAX_HEALTH = 100;

export const GRENADE_FUSE = 1.7;
export const GRENADE_RADIUS = 135; // blast radius (world units)
export const GRENADE_BODY_RADIUS = 14; // physical/visual body radius
export const GRENADE_DAMAGE = 45;
export const GRENADE_COOLDOWN = 1.2;
export const FRAG_GRENADE_COOLDOWN = 0.5;

export const PARTICLE_CAP = 320;
export const HIT_STOP_HURT = 0.04;
export const HIT_STOP_BOOM = 0.05;
export const SANDBOX_RESET_DELAY = 2.2;
export const ROUND_COUNTDOWN = 1.6;
export const ROUND_END_DELAY = 1.9;
export const CARD_PICK_TIMEOUT = 20; // seconds before the sim auto-picks offers[0]

// Swinging (pendulum) platforms: held by a string from an anchor; a player
// standing on one pushes it, and it swings back under gravity. They also bob
// vertically on a spring (a head-bump or a bullet knocks them up) so they feel
// like a mass on a string rather than a fixed platform.
export const SWING_MAX_ANGLE = 0.85; // rad
export const SWING_DAMPING = 0.9; // angular velocity damping
export const SWING_PLAYER_PUSH = 4.5; // torque scale from a standing player
export const SWING_BULLET_PUSH = 0.55; // angular kick per bullet hit (scaled by speed)
export const SWING_BULLET_BOB = 120; // vertical bob kick per bullet hit (px/s, scaled by push)
export const SWING_EXPLOSION_PUSH = 2.6; // angular kick from a nearby blast (scaled by proximity)
export const SWING_HEAD_PUSH = 0.4; // upward bob kick from a player head-bump (rope slackens)
export const BOB_STIFFNESS = 55; // (legacy spring constant, superseded by rope constraint)
export const BOB_DAMPING = 5.5; // (legacy spring damping, superseded by rope constraint)
export const BOB_MIN = -60; // max rope slack (block rises up to 60px above the circle)
export const BOB_MAX = 22; // (legacy max downward displacement, superseded by rope constraint)

export const PLAYER_COLORS = ["#4da3ff", "#ff9b3d", "#8be04e", "#c78bff"] as const;
// Team identity colors (team index → color). Used for the friendly-fire-off
// team markers and the lobby columns when teamCount > 1.
export const TEAM_COLORS = ["#4fc3f7", "#ff7a5c", "#9ccc65", "#c78bff"] as const;