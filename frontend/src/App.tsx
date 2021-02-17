import { Box, Flex, useBreakpointValue, useColorModeValue, VStack } from "@chakra-ui/react";
import React, { useEffect, useMemo, useState } from "react";
import { Route, RouteComponentProps, Switch } from "react-router-dom";
import "./App.css";
import Routing from "./AppRouting";
import EmojiMartProvider from "./aspects/Emoji/EmojiMartContext";
import LeftSidebar from "./aspects/Menu/LeftSidebar";
import MainMenu from "./aspects/Menu/MainMenu";
import RightSidebar from "./aspects/Menu/RightSidebar";
import CurrentUserProvider from "./aspects/Users/CurrentUser/CurrentUserProvider";
// import LastSeenProvider from "./aspects/Users/CurrentUser/OnlineStatus/LastSeenProvider";

interface AppProps {
    confSlug: string | undefined;
    rootUrl: string;
}

export default function App(): JSX.Element {
    return (
        <Switch>
            <Route
                path="/conference/:confSlug"
                component={(
                    props: RouteComponentProps<{
                        confSlug: string;
                    }>
                ) => <AppInner rootUrl={props.match.url} confSlug={props.match.params.confSlug} />}
            />
            <Route path="/">
                <AppInner rootUrl={""} confSlug={undefined} />
            </Route>
        </Switch>
    );
}

function AppInner({ confSlug, rootUrl }: AppProps): JSX.Element {
    const leftSidebarWidthPc = 20;
    const rightSidebarWidthPc = 20;
    const contentWidthPc = 100 - leftSidebarWidthPc - rightSidebarWidthPc;

    const bgColour = useColorModeValue("gray.50", "gray.900");

    const leftDefaultVisible = useBreakpointValue({
        base: false,
        lg: true,
    });
    const rightDefaultVisible = useBreakpointValue({
        base: false,
        xl: true,
    });
    const centerAlwaysVisible = useBreakpointValue({
        base: false,
        md: true,
    });
    const [leftOpen, setLeftOpen] = useState<boolean | null>(null);
    const [rightOpen, setRightOpen] = useState<boolean | null>(null);
    const leftVisible = !!leftOpen;
    const rightVisible = rightOpen && (rightDefaultVisible || !leftVisible);

    useEffect(() => {
        if (leftOpen === null && leftDefaultVisible !== undefined) {
            setLeftOpen(leftDefaultVisible);
        }
    }, [leftDefaultVisible, leftOpen]);

    useEffect(() => {
        if (rightOpen === null && rightDefaultVisible !== undefined) {
            setRightOpen(rightDefaultVisible);
        }
    }, [rightDefaultVisible, rightOpen]);

    const centerVisible = !confSlug || centerAlwaysVisible || (!leftVisible && !rightVisible);

    const left = useMemo(() => (confSlug ? <LeftSidebar rootUrl={rootUrl} confSlug={confSlug} /> : undefined), [
        confSlug,
        rootUrl,
    ]);
    const right = useMemo(() => (confSlug ? <RightSidebar rootUrl={rootUrl} confSlug={confSlug} /> : undefined), [
        confSlug,
        rootUrl,
    ]);
    const center = useMemo(() => <Routing />, []);

    const mainMenuProps = useMemo(
        () => ({
            isLeftBarOpen: leftVisible ?? false,
            onLeftBarClose: () => setLeftOpen(false),
            onLeftBarOpen: () => setLeftOpen(true),
            isRightBarOpen: rightVisible ?? false,
            onRightBarClose: () => {
                setRightOpen(false);
            },
            onRightBarOpen: () => {
                if (!rightDefaultVisible) {
                    setLeftOpen(false);
                }
                setRightOpen(true);
            },
        }),
        [leftVisible, rightDefaultVisible, rightVisible]
    );

    const page = useMemo(() => {
        const leftBar = confSlug ? (
            <Box
                overflow="hidden"
                height="100%"
                width={centerVisible ? leftSidebarWidthPc + "%" : "100%"}
                maxWidth={centerVisible ? "350px" : undefined}
                flex="1 0 300px"
                mb="auto"
                display={leftVisible ? "flex" : "none"}
            >
                {left}
            </Box>
        ) : undefined;
        const rightBar = confSlug ? (
            <Box
                overflow="hidden"
                height="100%"
                width={centerVisible ? rightSidebarWidthPc + "%" : "100%"}
                maxWidth={centerVisible ? "350px" : undefined}
                flex="1 0 300px"
                mb="auto"
                ml="auto"
                display={rightVisible ? "flex" : "none"}
            >
                {right}
            </Box>
        ) : undefined;
        const centerBar = (
            <Box
                overflowX="hidden"
                overflowY="auto"
                height="100%"
                width={contentWidthPc + "%"}
                flex="1 0 300px"
                mb="auto"
                position={centerVisible ? "relative" : "fixed"}
                top={centerVisible ? undefined : "100%"}
            >
                <VStack spacing={5} width="100%">
                    {center}
                    <Box h="40px" display="inline-block" flex="0 0 40px">
                        &nbsp;
                    </Box>
                </VStack>
            </Box>
        );
        return (
            <Flex
                as="main"
                height="100%"
                width="100%"
                minWidth="300px"
                overflow="hidden"
                // Column-reverse allows us to put the menu last so screen
                // readers see the page content before the menu
                direction="column-reverse"
                justifyContent="center"
                alignItems="center"
                backgroundColor={bgColour}
            >
                <MainMenu {...mainMenuProps}>
                    <Flex w="100%" h="100%" overflow="hidden">
                        {leftBar}
                        {centerBar}
                        {rightBar}
                    </Flex>
                </MainMenu>
            </Flex>
        );
    }, [
        bgColour,
        center,
        centerVisible,
        confSlug,
        contentWidthPc,
        left,
        leftVisible,
        mainMenuProps,
        right,
        rightVisible,
    ]);

    return (
        <EmojiMartProvider>
            {/* <LastSeenProvider /> */}
            <CurrentUserProvider>{page}</CurrentUserProvider>
        </EmojiMartProvider>
    );
}
