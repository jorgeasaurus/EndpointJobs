import {Composition} from "remotion";

import {EndpointJobsAd, type EndpointJobsAdProps} from "./EndpointJobsAd";
import {EndpointJobsSocial, type EndpointJobsSocialProps, SOCIAL_DURATION_SECONDS} from "./EndpointJobsSocial";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="EndpointJobsAd"
        component={EndpointJobsAd}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{siteUrl: "endpointjobs.dev"} satisfies EndpointJobsAdProps}
      />
      <Composition
        id="EndpointJobsSocial"
        component={EndpointJobsSocial}
        durationInFrames={Math.round(SOCIAL_DURATION_SECONDS * 30)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{siteUrl: "endpointjobs.dev"} satisfies EndpointJobsSocialProps}
      />
    </>
  );
};
