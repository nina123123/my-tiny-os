/*
 * ✏️ Look switches that aren't colors (colors, fonts and moods live in
 * src/styles/tokens.css and src/content/moods.ts).
 */

/**
 * The wallpaper behind everything:
 *  - 'blobs': slow, glossy 3D glass blobs (WebGL), falling back to 'soft' where WebGL isn't available
 *  - 'soft':  the same idea as gently drifting blurred CSS blobs (lighter, no WebGL)
 *  - 'flat':  only each mood's --bg-grad from tokens.css plus a little film grain. Start here for
 *             paper, concrete, graph-paper or any other look you paint yourself in
 *             src/fx/wallpaper/wallpaper.css (.wp__base).
 * The blobs read their colors from --wp-a … --wp-e in tokens.css.
 */
export const WALLPAPER: 'blobs' | 'soft' | 'flat' = 'blobs'
