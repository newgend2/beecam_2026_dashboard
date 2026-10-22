# BeeCam 2026 dashboard

BeeCam is a bumble bee (*Bombus*) monitoring project. Small field cameras built on a
Raspberry Pi with an AI camera photograph insects visiting flowers and targets, and a
two-stage model finds the bumble bees in those images. Every bee shown on this site has been
confirmed by a person.

The [website](https://newgend2.github.io/beecam_2026_dashboard/) (GitHub Pages) presents the 2026 field season:

- **Overview**: season totals and a slideshow of the sharpest bumble bee visits.
- **Camera map**: activity across the camera grid at the Emerald Queen site
  (Willow Creek, California).
- **Gallery**: every confirmed bumble bee frame, or one image per visit, with camera
  and date filters, sorted by time or with the sharpest images first.
- **Analytics**: activity by camera location and over the season.
- **Model training**: how the two-stage detector and classifier finds bumble bees, with a
  demo video and its results.
- **Camera status**: the final state of each camera at the end of the season.
- **Clover cams (Oregon)**: a separate site, four timelapse cameras in a clover field near
  Philomath, Oregon, with their confirmed bumble bee frames and visits and a short analysis of
  how many of those visits the cameras' own on-board model would have caught.
- **Downloads**: CSV lists of the published frames and visits, and ZIP archives of the image
  crops.

Notes for rebuilding and deploying the site are in [MAINTAINING.md](MAINTAINING.md).
