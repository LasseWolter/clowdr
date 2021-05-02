import {
    Box,
    Button,
    Heading,
    HStack,
    Image,
    Link,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalHeader,
    ModalOverlay,
    Portal,
    Spacer,
    Spinner,
    Text,
    useToast,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback } from "react";
import { useHistory } from "react-router-dom";
import { useCreateDmMutation } from "../../../../generated/graphql";
import BadgeList from "../../../Badges/BadgeList";
import { LinkButton } from "../../../Chakra/LinkButton";
import FAIcon from "../../../Icons/FAIcon";
import PronounList from "../../../Pronouns/PronounList";
import { Markdown } from "../../../Text/Markdown";
import { useConference } from "../../useConference";
import { Registrant, useMaybeCurrentRegistrant } from "../../useCurrentRegistrant";
import RegistrantExtraInfo from "../Profile/RegistrantExtraInfo";

export default function ProfileModal({
    registrant,
    isOpen,
    onClose,
}: {
    registrant: Registrant | null;
    isOpen: boolean;
    onClose: () => void;
}): JSX.Element {
    const conference = useConference();
    const mCurrentRegistrant = useMaybeCurrentRegistrant();
    const history = useHistory();

    const [createDmMutation, { loading: creatingDM }] = useCreateDmMutation();
    const toast = useToast();
    const createDM = useCallback(async () => {
        if (registrant) {
            try {
                const result = await createDmMutation({
                    variables: {
                        registrantIds: [registrant.id],
                        conferenceId: conference.id,
                    },
                });
                if (result.errors || !result.data?.createRoomDm?.roomId) {
                    console.error("Failed to create DM", result.errors);
                    throw new Error("Failed to create DM");
                } else {
                    if (result.data.createRoomDm.message !== "DM already exists") {
                        toast({
                            title: result.data.createRoomDm.message ?? "Created new DM",
                            status: "success",
                        });
                    }

                    // Wait, because Vonage session creation is not instantaneous
                    setTimeout(() => {
                        history.push(`/conference/${conference.slug}/room/${result.data?.createRoomDm?.roomId}`);
                        onClose();
                    }, 2000);

                    onClose();
                }
            } catch (e) {
                toast({
                    title: "Could not create DM",
                    status: "error",
                });
                console.error("Could not create DM", e);
            }
        }
    }, [registrant, conference.id, conference.slug, createDmMutation, history, onClose, toast]);

    return (
        <Portal>
            <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside">
                <ModalOverlay />
                <ModalContent maxW={350} pb={4}>
                    <ModalHeader>
                        {registrant ? (
                            <>
                                <Heading as="h4" size="sm" textAlign="left" mr={8}>
                                    {registrant.displayName}
                                    <br />
                                    {registrant.profile.affiliation ? (
                                        <Text as="span" fontStyle="italic" fontSize="0.9em">
                                            ({registrant.profile.affiliation})
                                        </Text>
                                    ) : undefined}
                                </Heading>
                            </>
                        ) : undefined}
                    </ModalHeader>
                    <ModalCloseButton />
                    <ModalBody px={0}>
                        {registrant ? (
                            <VStack spacing={4}>
                                <HStack justifyContent="flex-start" w="100%" px={2} alignItems="flex-start">
                                    <VStack alignItems="flex-start">
                                        {registrant.profile.pronouns ? (
                                            <PronounList pronouns={registrant.profile.pronouns} px={2} />
                                        ) : undefined}
                                        {registrant.profile.affiliation ? (
                                            <Text>
                                                {registrant.profile.affiliationURL ? (
                                                    <>
                                                        <FAIcon iconStyle="s" icon="link" fontSize="0.7rem" />
                                                        &nbsp;
                                                        <Link
                                                            isExternal
                                                            href={`https://${registrant.profile.affiliationURL}`}
                                                        >
                                                            {registrant.profile.affiliation}
                                                        </Link>
                                                    </>
                                                ) : (
                                                    registrant.profile.affiliation
                                                )}
                                            </Text>
                                        ) : undefined}
                                    </VStack>
                                    <Spacer />
                                    <VStack alignItems="stretch">
                                        {mCurrentRegistrant &&
                                        mCurrentRegistrant?.id !== registrant.id &&
                                        registrant.userId ? (
                                            <Button
                                                onClick={createDM}
                                                isLoading={creatingDM}
                                                colorScheme="green"
                                                size="sm"
                                            >
                                                <FAIcon icon="comment" iconStyle="s" mr={3} /> DM
                                            </Button>
                                        ) : undefined}
                                        <LinkButton
                                            to={`/conference/${conference.slug}/profile/view/${registrant.id}`}
                                            size="sm"
                                            variant="outline"
                                            colorScheme="green"
                                        >
                                            <FAIcon iconStyle="s" icon="link" mr={2} />
                                            View profile
                                        </LinkButton>
                                    </VStack>
                                </HStack>
                                {registrant.profile.photoURL_350x350 ? (
                                    <Image
                                        maxW={350}
                                        maxH={350}
                                        w="100%"
                                        h="auto"
                                        aria-describedby={`registrant-trigger-${registrant.id}`}
                                        src={registrant.profile.photoURL_350x350}
                                    />
                                ) : undefined}
                                {registrant.profile.badges ? (
                                    <BadgeList badges={registrant.profile.badges} px={2} />
                                ) : undefined}
                                {registrant.profile.bio ? (
                                    <Box py={0} px={2} w="100%">
                                        <Markdown restrictHeadingSize>{registrant.profile.bio}</Markdown>
                                    </Box>
                                ) : undefined}
                                <RegistrantExtraInfo registrant={registrant} mb={4} px={2} maxW="100%" />
                            </VStack>
                        ) : (
                            <Spinner label="Loading registrant profile, please wait" />
                        )}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Portal>
    );
}