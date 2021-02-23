import { gql } from "@apollo/client";
import { Box, BoxProps, Button, Center, Flex, Heading, Spinner, useColorModeValue } from "@chakra-ui/react";
import Observer from "@researchgate/react-intersection-observer";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ChatMessageDataFragment,
    useNewMessagesSubscription,
    useSelectFirstMessagesPageLazyQuery,
    useSelectMessagesPageLazyQuery,
} from "../../../generated/graphql";
import { useChatConfiguration } from "../Configuration";
import MessageBox from "./MessageBox";
import { useReceiveMessageQueries } from "./ReceiveMessageQueries";

interface ChatMessageListProps {
    chatId: string;
}

interface MessageListProps {
    chatId: string;
    isLoading: boolean;
    fetchMore: () => void;
    insertMessagesRef: React.MutableRefObject<((messages: ChatMessageDataFragment[], areNew: boolean) => void) | null>;
    deleteMessagesRef: React.MutableRefObject<((messageIds: number[]) => void) | null>;
    setHasReachedEndRef: React.MutableRefObject<((value: boolean) => void) | null>;
}

gql`
    query SelectFirstMessagesPage($chatId: uuid!, $maxCount: Int!) {
        chat_Message(order_by: { id: desc }, where: { chatId: { _eq: $chatId } }, limit: $maxCount) {
            ...ChatMessageData
        }
    }

    query SelectMessagesPage($chatId: uuid!, $startAtIndex: Int!, $maxCount: Int!) {
        chat_Message(
            order_by: { id: desc }
            where: { chatId: { _eq: $chatId }, id: { _lte: $startAtIndex } }
            limit: $maxCount
        ) {
            ...ChatMessageData
        }
    }

    fragment SubscribedChatMessageData on chat_Message {
        created_at
        data
        duplicatedMessageId
        id
        message
        senderId
        type
        chatId
    }

    subscription NewMessages($chatId: uuid!) {
        chat_Message(order_by: { id: desc }, where: { chatId: { _eq: $chatId } }, limit: 5) {
            ...SubscribedChatMessageData
        }
    }
`;

export function ChatMessageList({ chatId, ...rest }: ChatMessageListProps & BoxProps): JSX.Element {
    const insertMessages = React.useRef<((messages: ChatMessageDataFragment[], areNew: boolean) => void) | null>(null);
    const deleteMessages = React.useRef<((messageIds: number[]) => void) | null>(null);
    const setHasReachedEnd = React.useRef<((value: boolean) => void) | null>(null);

    const [selectMessagesPage, selectMessagesPageResponse] = useSelectMessagesPageLazyQuery();
    const [selectFirstMessagesPage, selectFirstMessagesPageResponse] = useSelectFirstMessagesPageLazyQuery();

    const config = useChatConfiguration();
    const batchSize = config.messageBatchSize ?? 30;

    const lastMessageId = React.useRef<number>(-1);
    const prevLastMessageId = React.useRef<number>(-2);

    const nextMessageSub = useNewMessagesSubscription({
        variables: {
            chatId,
        },
    });

    const requestedNextPage = React.useRef<boolean>(false);
    const requestedFirstPage = React.useRef<boolean>(false);

    useEffect(() => {
        lastMessageId.current = Number.MAX_SAFE_INTEGER;
        prevLastMessageId.current = Number.POSITIVE_INFINITY;
    }, [chatId]);
    const fetchMore = useCallback(() => {
        if (lastMessageId.current === Number.MAX_SAFE_INTEGER) {
            if (!requestedFirstPage.current) {
                requestedFirstPage.current = true;
                selectFirstMessagesPage({
                    variables: {
                        chatId,
                        maxCount: batchSize,
                    },
                });
            }
        } else {
            if (!requestedNextPage.current) {
                requestedNextPage.current = true;
                selectMessagesPage({
                    variables: {
                        chatId,
                        maxCount: batchSize,
                        startAtIndex: lastMessageId.current,
                    },
                });
            }
        }
    }, [batchSize, chatId, selectFirstMessagesPage, selectMessagesPage]);

    useEffect(() => {
        if (selectMessagesPageResponse.data) {
            prevLastMessageId.current = lastMessageId.current;
            lastMessageId.current = Math.min(
                lastMessageId.current,
                selectMessagesPageResponse.data.chat_Message[selectMessagesPageResponse.data.chat_Message.length - 1]
                    ?.id ?? -1
            );
            if (prevLastMessageId.current === lastMessageId.current && setHasReachedEnd.current) {
                setHasReachedEnd.current(true);
            }
            insertMessages.current?.([...selectMessagesPageResponse.data.chat_Message], !requestedNextPage.current);
            requestedNextPage.current = false;
        }
    }, [selectMessagesPageResponse.data]);

    useEffect(() => {
        if (selectFirstMessagesPageResponse.data) {
            prevLastMessageId.current = lastMessageId.current;
            lastMessageId.current = Math.min(
                lastMessageId.current,
                selectFirstMessagesPageResponse.data.chat_Message[
                    selectFirstMessagesPageResponse.data.chat_Message.length - 1
                ]?.id ?? -1
            );
            insertMessages.current?.(
                [...selectFirstMessagesPageResponse.data.chat_Message],
                !requestedFirstPage.current
            );
            requestedFirstPage.current = false;

            if (selectFirstMessagesPageResponse.data.chat_Message.length < batchSize && setHasReachedEnd.current) {
                setHasReachedEnd.current(true);
            }
        }
    }, [batchSize, selectFirstMessagesPageResponse.data]);

    useEffect(() => {
        if (nextMessageSub.data) {
            insertMessages.current?.(
                nextMessageSub.data.chat_Message.map((msg) => ({
                    ...msg,
                    reactions: [],
                })),
                true
            );
        }
    }, [nextMessageSub.data]);

    const receiveMessageQueries = useReceiveMessageQueries();
    useEffect(() => {
        deleteMessages.current?.([...receiveMessageQueries.deletedItems.values()]);
    }, [receiveMessageQueries.deletedItems]);

    return (
        <MessageList
            chatId={chatId}
            insertMessagesRef={insertMessages}
            deleteMessagesRef={deleteMessages}
            setHasReachedEndRef={setHasReachedEnd}
            isLoading={selectMessagesPageResponse.loading}
            fetchMore={fetchMore}
            {...rest}
        />
    );
}

function MessageList({
    chatId,
    isLoading,
    insertMessagesRef,
    deleteMessagesRef,
    setHasReachedEndRef,
    fetchMore,
    ...rest
}: MessageListProps & BoxProps): JSX.Element {
    const [hasReachedEnd, setHasReachedEnd] = useState<boolean>(false);
    const [messageElements, setMessageElements] = useState<JSX.Element[] | null>(null);

    useEffect(() => {
        setHasReachedEnd(false);
        setMessageElements(null);
    }, [chatId]);

    const scrollbarColour = useColorModeValue("gray.500", "gray.200");
    const scrollbarBackground = useColorModeValue("gray.200", "gray.500");

    const ref = React.useRef<HTMLDivElement | null>(null);
    const shouldAutoScroll = React.useRef<boolean>(true);

    const insertMessages = useCallback((messages: ChatMessageDataFragment[], areNew: boolean) => {
        setMessageElements((oldEls) => {
            const reactionsBoundary = 5;
            // Yes, double equals not triple - React does something weird to the keys which changes their type
            const nonDuplicates = messages.filter((msg) => !oldEls?.some((el) => el.key == msg.id));
            // Yes, double equals not triple - React does something weird to the keys which changes their type
            const duplicates = messages.filter((msg) => !nonDuplicates?.some((msg2) => msg2.id == msg.id));
            const newMessageElements = nonDuplicates
                .sort((x, y) => y.id - x.id)
                .map((msg, idx) => (
                    <MessageBox
                        key={msg.id}
                        message={msg}
                        subscribeToReactions={(areNew || !oldEls) && idx < reactionsBoundary}
                    />
                ));
            let output;
            if (oldEls) {
                if (areNew) {
                    output = [
                        ...newMessageElements,
                        ...oldEls.map((el, idx) => {
                            // Yes, double equals not triple - React does something weird to the keys which changes their type
                            const newMsgIdx = duplicates.findIndex((x) => x.id == el.key);

                            if (newMsgIdx !== -1) {
                                const newMsg = duplicates[newMsgIdx];
                                duplicates.splice(newMsgIdx, 1);
                                return (
                                    <MessageBox
                                        key={el.key}
                                        message={newMsg}
                                        subscribeToReactions={idx + newMessageElements.length < reactionsBoundary}
                                    />
                                );
                            } else if (
                                idx < reactionsBoundary &&
                                idx + newMessageElements.length >= reactionsBoundary
                            ) {
                                return (
                                    <MessageBox key={el.key} message={el.props.message} subscribeToReactions={false} />
                                );
                            } else {
                                return el;
                            }
                        }),
                    ];
                } else {
                    output = [
                        ...oldEls.map((el, idx) => {
                            // Yes, double equals not triple - React does something weird to the keys which changes their type
                            const newMsgIdx = duplicates.findIndex((x) => x.id == el.key);

                            if (newMsgIdx !== -1) {
                                const newMsg = duplicates[newMsgIdx];
                                duplicates.splice(newMsgIdx, 1);
                                return (
                                    <MessageBox
                                        key={el.key}
                                        message={newMsg}
                                        subscribeToReactions={idx < reactionsBoundary}
                                    />
                                );
                            } else {
                                return el;
                            }
                        }),
                        ...newMessageElements,
                    ];
                }
            } else {
                output = newMessageElements.map((el, idx) => {
                    // Yes, double equals not triple - React does something weird to the keys which changes their type
                    const newMsgIdx = duplicates.findIndex((x) => x.id == el.key);

                    if (newMsgIdx !== -1) {
                        const newMsg = duplicates[newMsgIdx];
                        duplicates.splice(newMsgIdx, 1);
                        return (
                            <MessageBox key={el.key} message={newMsg} subscribeToReactions={idx < reactionsBoundary} />
                        );
                    } else {
                        return el;
                    }
                });
            }

            if (shouldAutoScroll.current) {
                ref.current?.scroll({
                    behavior: "smooth",
                    top: 0,
                });
            }

            return output;
        });
    }, []);

    const deleteMessages = useCallback((messageIds: number[]) => {
        setMessageElements((oldEls) => {
            if (oldEls) {
                const ids = messageIds.map((x) => x.toString());
                return oldEls.filter((el) => !ids.includes(el.key as string));
            }
            return null;
        });
    }, []);

    insertMessagesRef.current = insertMessages;
    deleteMessagesRef.current = deleteMessages;
    setHasReachedEndRef.current = setHasReachedEnd;

    const topEl = useMemo(() => {
        return isLoading ? (
            <Center py={5} mb={1}>
                <Spinner message="Loading messages" />
            </Center>
        ) : hasReachedEnd ? (
            <Heading
                py={5}
                mb={1}
                as="h4"
                fontSize="0.8em"
                fontStyle="italic"
                borderBottomWidth={1}
                borderBottomStyle="solid"
                borderBottomColor="gray.400"
            >
                (No more messages)
            </Heading>
        ) : (
            <Observer
                onChange={(props) => {
                    if (props.intersectionRatio > 0) {
                        fetchMore();
                    }
                }}
            >
                <Center
                    py={5}
                    mb={1}
                    h="auto"
                    fontStyle="italic"
                    borderBottomWidth={1}
                    borderBottomStyle="solid"
                    borderBottomColor="gray.400"
                >
                    <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                            fetchMore();
                        }}
                        fontSize="90%"
                        h="auto"
                        p={2}
                        lineHeight="130%"
                    >
                        Infinite scroller not working?
                        <br />
                        Click to load more messages.
                    </Button>
                </Center>
            </Observer>
        );
    }, [fetchMore, hasReachedEnd, isLoading]);

    const bottomEl = useMemo(() => {
        return (
            <Observer
                onChange={(ev) => {
                    shouldAutoScroll.current = ev.intersectionRatio > 0;
                }}
            >
                <Box m={0} p={0} h={0} w="100%"></Box>
            </Observer>
        );
    }, []);

    // CHAT_TODO
    // const readUpTo = useReadUpToIndex();
    // useEffect(() => {
    //     if (messageElements && messageElements.length > 0) {
    //         const latestId = messageElements[0].props.message.id;
    //         if (readUpTo.readUpToId === undefined || readUpTo.readUpToId < latestId) {
    //             readUpTo.setReadUpTo(latestId);
    //         }
    //     }
    // }, [messageElements, readUpTo]);

    return (
        <Box {...rest}>
            {messageElements === null ? (
                <Center h="100%">
                    <Box>
                        <Spinner aria-label="Loading messages" />
                    </Box>
                </Center>
            ) : (
                <Flex w="100%" h="100%" overflowX="hidden" overflowY="auto" flexDir="column" justifyContent="flex-end">
                    <Flex
                        role="list"
                        w="100%"
                        h="auto"
                        overflowX="hidden"
                        overflowY="scroll"
                        flexDir="column-reverse"
                        minH="100%"
                        css={{
                            ["scrollbarWidth"]: "thin",
                            ["scrollbarColor"]: `${scrollbarColour} ${scrollbarBackground}`,
                        }}
                        ref={ref}
                    >
                        {bottomEl}
                        {messageElements}
                        {topEl}
                    </Flex>
                </Flex>
            )}
        </Box>
    );
}
