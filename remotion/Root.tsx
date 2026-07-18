import {Composition} from "remotion";

import {EndpointJobsAd, type EndpointJobsAdProps} from "./EndpointJobsAd";

export const RemotionRoot = () => {
  return (
    <Composition
      id="EndpointJobsAd"
      component={EndpointJobsAd}
      durationInFrames={600}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={
        {
          siteUrl: "endpointjobs.dev",
        } satisfies EndpointJobsAdProps
      }
    />
  );
};
