import { Alert, AlertIcon, AlertTitle, Box, Flex, useBreakpointValue, useToast, VStack } from "@chakra-ui/react";
import * as R from "ramda";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";
import { useLocation } from "react-router-dom";
import useUserId from "../../../../Auth/useUserId";
import ChatProfileModalProvider from "../../../../Chat/Frame/ChatProfileModalProvider";
import { useVonageRoom, VonageRoomStateActionType, VonageRoomStateProvider } from "../../../../Vonage/useVonageRoom";
import useCurrentAttendee, { useMaybeCurrentAttendee } from "../../../useCurrentAttendee";
import PlaceholderImage from "../PlaceholderImage";
import { PreJoin } from "../PreJoin";
import { useVonageComputedState } from "./useVonageComputedState";
import { VonageOverlay } from "./VonageOverlay";
import { VonageRoomControlBar } from "./VonageRoomControlBar";
import { VonageSubscriber } from "./VonageSubscriber";

export function VonageRoom({
    vonageSessionId,
    getAccessToken,
    disable,
    isBackstageRoom,
}: {
    vonageSessionId: string;
    getAccessToken: () => Promise<string>;
    disable: boolean;
    isBackstageRoom: boolean;
}): JSX.Element {
    const mAttendee = useMaybeCurrentAttendee();

    const location = useLocation();
    const locationParts = (location.pathname.startsWith("/") ? location.pathname.substr(1) : location.pathname).split(
        "/"
    );
    // Array(5) [ "conference", "demo2021", "room", "96b73184-a5ae-4356-81d7-5f99689d1413" ]
    const roomCouldBeInUse = locationParts[0] === "conference" && locationParts[2] === "room";

    return (
        <VonageRoomStateProvider>
            <ChatProfileModalProvider>
                {mAttendee ? (
                    <VonageRoomInner
                        vonageSessionId={vonageSessionId}
                        stop={!roomCouldBeInUse || disable}
                        getAccessToken={getAccessToken}
                        isBackstageRoom={isBackstageRoom}
                    />
                ) : undefined}
            </ChatProfileModalProvider>
        </VonageRoomStateProvider>
    );
}

function VonageRoomInner({
    vonageSessionId,
    getAccessToken,
    stop,
    isBackstageRoom,
}: {
    vonageSessionId: string;
    getAccessToken: () => Promise<string>;
    stop: boolean;
    isBackstageRoom: boolean;
}): JSX.Element {
    const { state, dispatch } = useVonageRoom();
    const { vonage, connected, connections, streams, screen, camera } = useVonageComputedState(
        getAccessToken,
        vonageSessionId
    );

    const userId = useUserId();
    const attendee = useCurrentAttendee();
    const toast = useToast();

    const cameraPublishContainerRef = useRef<HTMLDivElement>(null);
    const screenPublishContainerRef = useRef<HTMLDivElement>(null);
    const cameraPreviewRef = useRef<HTMLVideoElement>(null);

    const [joining, setJoining] = useState<boolean>(false);

    const resolutionBP = useBreakpointValue<"low" | "normal" | "high">({
        base: "low",
        lg: "normal",
    });
    const receivingScreenShare = useMemo(() => streams.find((s) => s.videoType === "screen"), [streams]);
    const screenSharingActive = receivingScreenShare || screen;
    const maxVideoStreams = screenSharingActive ? 4 : 10;
    const cameraResolution =
        screenSharingActive || connections.length >= maxVideoStreams ? "low" : resolutionBP ?? "normal";
    const participantWidth = cameraResolution === "low" ? 150 : 300;

    const joinRoom = useCallback(async () => {
        console.log("Joining room");
        setJoining(true);

        try {
            await vonage.connectToSession();
            await vonage.publishCamera(
                cameraPublishContainerRef.current as HTMLElement,
                state.cameraIntendedEnabled ? state.preferredCameraId : null,
                state.microphoneIntendedEnabled ? state.preferredMicrophoneId : null,
                isBackstageRoom ? "1280x720" : "640x480"
            );
        } catch (e) {
            console.error("Failed to join room", e);
            toast({
                status: "error",
                description: "Cannot connect to room",
            });
        } finally {
            setJoining(false);
        }
    }, [
        vonage,
        state.cameraIntendedEnabled,
        state.preferredCameraId,
        state.microphoneIntendedEnabled,
        state.preferredMicrophoneId,
        isBackstageRoom,
        toast,
    ]);

    const leaveRoom = useCallback(async () => {
        if (connected) {
            try {
                await vonage.disconnect();
            } catch (e) {
                console.warn("Failed to leave room", e);
                toast({
                    status: "error",
                    title: "Failed to leave room",
                });
            }
        }
        setJoining(false);
        dispatch({
            type: VonageRoomStateActionType.SetMicrophoneIntendedState,
            microphoneEnabled: false,
        });
        dispatch({
            type: VonageRoomStateActionType.SetCameraIntendedState,
            cameraEnabled: false,
        });
    }, [connected, dispatch, toast, vonage]);

    useEffect(() => {
        if (stop) {
            leaveRoom().catch((e) => console.error("Failed to leave room", e));
        }
    }, [leaveRoom, stop]);

    useEffect(() => {
        async function fn() {
            if (connected) {
                try {
                    await vonage.publishCamera(
                        cameraPublishContainerRef.current as HTMLElement,
                        state.cameraIntendedEnabled ? state.preferredCameraId : null,
                        state.microphoneIntendedEnabled ? state.preferredMicrophoneId : null
                    );
                } catch (e) {
                    toast({
                        status: "error",
                        title: "Failed to publish camera",
                    });
                }
            }
        }
        fn();
    }, [
        connected,
        state.cameraIntendedEnabled,
        state.microphoneIntendedEnabled,
        state.preferredCameraId,
        state.preferredMicrophoneId,
        toast,
        vonage,
    ]);

    useEffect(() => {
        async function fn() {
            if (connected) {
                if (state.screenShareIntendedEnabled && !screen) {
                    try {
                        await vonage.publishScreen(screenPublishContainerRef.current as HTMLElement);
                    } catch (e) {
                        console.error("Failed to publish screen", e);
                        toast({
                            status: "error",
                            title: "Failed to share screen",
                        });
                    }
                } else if (!state.screenShareIntendedEnabled && screen) {
                    try {
                        await vonage.unpublishScreen();
                    } catch (e) {
                        console.error("Failed to unpublish screen", e);
                        toast({
                            status: "error",
                            title: "Failed to unshare screen",
                        });
                    }
                }
            }
        }
        fn();
    }, [connected, screen, state.screenShareIntendedEnabled, toast, vonage]);

    const [streamLastActive, setStreamLastActive] = useState<{ [streamId: string]: number }>({});
    const setStreamActivity = useCallback((streamId: string, activity: boolean) => {
        if (activity) {
            setStreamLastActive((streamLastActiveData) => ({
                ...streamLastActiveData,
                [streamId]: Date.now(),
            }));
        }
    }, []);
    const othersCameraStreams = useMemo(() => streams.filter((s) => s.videoType === "camera" || !s.videoType), [
        streams,
    ]);
    const sortedStreams = useMemo(() => R.sortWith([R.ascend(R.prop("creationTime"))], othersCameraStreams), [
        othersCameraStreams,
    ]);

    const [enableStreams, setEnableStreams] = useState<string[] | null>(null);
    useEffect(() => {
        if (othersCameraStreams.length <= maxVideoStreams) {
            setEnableStreams(null);
        } else {
            const streamTimestamps = R.toPairs(streamLastActive) as [string, number][];
            // console.log(`${new Date().toISOString()}: Proceeding with computing enabled streams`, streamTimestamps);
            const activeStreams = R.sortWith(
                [R.descend((pair) => pair[1]), R.ascend((pair) => pair[0])],
                streamTimestamps
            ).map((pair) => pair[0]);
            const selectedActiveStreams = activeStreams.slice(0, Math.min(activeStreams.length, maxVideoStreams));

            setEnableStreams((oldEnabledStreams) => {
                if (!oldEnabledStreams) {
                    // console.log("Active speakers changed (1)");
                    return selectedActiveStreams;
                }

                if (
                    selectedActiveStreams.length !== oldEnabledStreams.length ||
                    oldEnabledStreams.some((x) => !selectedActiveStreams.includes(x)) ||
                    selectedActiveStreams.some((x) => !oldEnabledStreams.includes(x))
                ) {
                    // console.log("Active speakers changed (2)");
                    return selectedActiveStreams;
                } else {
                    return oldEnabledStreams;
                }
            });
        }
    }, [maxVideoStreams, othersCameraStreams.length, screenSharingActive, streamLastActive]);

    const viewPublishedScreenShareEl = useMemo(
        () => (
            <Box position="relative" maxH="80vh" hidden={!screen} height={"70vh"} width="100%" mb={2} overflow="hidden">
                <Box ref={screenPublishContainerRef} position="absolute" left="0" top="0" height="100%" width="100%" />
                <Box
                    position="absolute"
                    zIndex="200"
                    left="0"
                    top="0"
                    height="100%"
                    width="100%"
                    pointerEvents="none"
                />
                <Box position="absolute" left="0.4rem" bottom="0.35rem" zIndex="200" width="100%">
                    <VonageOverlay connectionData={JSON.stringify({ attendeeId: attendee.id })} />
                </Box>
            </Box>
        ),
        [attendee.id, screen]
    );

    const fullScreenHandle = useFullScreenHandle();

    const viewSubscribedScreenShare = useMemo(
        () => (
            <FullScreen handle={fullScreenHandle}>
                <Box
                    onClick={async () => {
                        try {
                            if (fullScreenHandle.active) {
                                fullScreenHandle.exit();
                            } else {
                                await fullScreenHandle.enter();
                            }
                        } catch (e) {
                            console.error("Could not enter full screen", e);
                        }
                    }}
                    maxH={fullScreenHandle.active ? "100%" : "80vh"}
                    height={fullScreenHandle.active ? "100%" : receivingScreenShare ? "70vh" : undefined}
                    width="100%"
                    mb={2}
                    zIndex={300}
                    hidden={!receivingScreenShare}
                >
                    {streams
                        .filter((stream) => stream.videoType === "screen")
                        .map((stream) => (
                            <VonageSubscriber
                                key={stream.streamId}
                                stream={stream}
                                enableVideo={true}
                                resolution={"high"}
                            />
                        ))}
                </Box>
            </FullScreen>
        ),
        [fullScreenHandle, receivingScreenShare, streams]
    );

    const viewPublishedPlaceholder = useMemo(
        () =>
            connected && !camera ? (
                <Box position="relative" flex={`0 0 ${participantWidth}px`} w={participantWidth} h={participantWidth}>
                    <Box position="absolute" left="0" bottom="0" zIndex="200" width="100%" overflow="hidden">
                        <VonageOverlay connectionData={JSON.stringify({ attendeeId: attendee.id })} />
                    </Box>
                    <PlaceholderImage />
                </Box>
            ) : (
                <></>
            ),
        [attendee.id, camera, connected, participantWidth]
    );

    const viewPublishedCamera = useMemo(
        () => (
            <Box
                flex={`0 0 ${participantWidth}px`}
                w={participantWidth}
                h={participantWidth}
                display={connected && camera ? "block" : "none"}
            >
                <Box position="relative" height="100%" width="100%" overflow="hidden">
                    <Box
                        ref={cameraPublishContainerRef}
                        position="absolute"
                        zIndex="100"
                        left="0"
                        top="0"
                        height="100%"
                        width="100%"
                    />
                    <Box
                        position="absolute"
                        zIndex="200"
                        left="0"
                        top="0"
                        height="100%"
                        width="100%"
                        pointerEvents="none"
                    />
                    <Box position="absolute" left="0.4rem" bottom="0.2rem" zIndex="200" width="100%" overflow="hidden">
                        <VonageOverlay connectionData={JSON.stringify({ attendeeId: attendee.id })} />
                    </Box>
                </Box>
            </Box>
        ),
        [attendee.id, camera, connected, participantWidth]
    );

    const preJoin = useMemo(
        () =>
            joining || connected ? (
                <></>
            ) : (
                <VStack justifyContent="center" height="100%" width="100%">
                    <PreJoin cameraPreviewRef={cameraPreviewRef} />
                </VStack>
            ),
        [connected, joining]
    );

    const nobodyElseAlert = useMemo(
        () =>
            connected && connections.length <= 1 ? (
                <Alert status="info">
                    <AlertIcon />
                    <AlertTitle>Nobody else has joined the room at the moment</AlertTitle>
                </Alert>
            ) : (
                <></>
            ),
        [connected, connections.length]
    );

    const otherStreams = useMemo(
        () =>
            sortedStreams.map((stream) => (
                <Box key={stream.streamId} flex={`0 0 ${participantWidth}px`} w={participantWidth} h={participantWidth}>
                    <VonageSubscriber
                        stream={stream}
                        onChangeActivity={(activity) => setStreamActivity(stream.streamId, activity)}
                        enableVideo={!enableStreams || !!enableStreams.includes(stream.streamId)}
                        resolution={cameraResolution}
                    />
                </Box>
            )),
        [enableStreams, cameraResolution, participantWidth, setStreamActivity, sortedStreams]
    );

    const otherUnpublishedConnections = useMemo(
        () =>
            (connected ? connections : []).filter(
                (connection) =>
                    userId &&
                    !connection.data.includes(userId) &&
                    !streams.find((stream) => stream.connection.connectionId === connection.connectionId)
            ),
        [connected, connections, streams, userId]
    );

    const otherPlaceholders = useMemo(
        () =>
            otherUnpublishedConnections.map((connection) => (
                <Box
                    key={connection.connectionId}
                    position="relative"
                    flex={`0 0 ${participantWidth}px`}
                    w={participantWidth}
                    h={participantWidth}
                >
                    <Box position="absolute" left="0.4rem" bottom="0.2rem" zIndex="200" width="100%" overflow="hidden">
                        <VonageOverlay connectionData={connection.data} />
                    </Box>
                    <PlaceholderImage />
                </Box>
            )),
        [otherUnpublishedConnections, participantWidth]
    );

    return (
        <Box>
            {/* Use memo'ing the control bar causes the screenshare button to not update properly 🤔 */}
            <VonageRoomControlBar onJoinRoom={joinRoom} onLeaveRoom={leaveRoom} joining={joining} />
            <Box position="relative" mb={8} width="100%">
                {viewPublishedScreenShareEl}

                {viewSubscribedScreenShare}

                <Flex
                    width="100%"
                    height="auto"
                    flexWrap={screenSharingActive ? "nowrap" : "wrap"}
                    overflowX={screenSharingActive ? "auto" : "hidden"}
                    overflowY={screenSharingActive ? "hidden" : "auto"}
                >
                    {viewPublishedPlaceholder}

                    {viewPublishedCamera}

                    {otherStreams}

                    {otherPlaceholders}
                </Flex>

                {nobodyElseAlert}

                {preJoin}
            </Box>
        </Box>
    );
}
