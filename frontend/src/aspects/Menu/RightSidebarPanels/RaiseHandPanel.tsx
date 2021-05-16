import { Box, Spinner } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";
import { EventVonageRoom } from "../../Conference/Attend/Room/Event/EventVonageRoom";
import { useRegistrants } from "../../Conference/RegistrantsContext";
import type { Registrant } from "../../Conference/useCurrentRegistrant";
import { useRaiseHandState } from "../../RaiseHand/RaiseHandProvider";
import useCurrentUser from "../../Users/CurrentUser/useCurrentUser";
import { RegistrantsList } from "./RegistrantsList";

export function RaiseHandPanel(): JSX.Element {
    const raiseHand = useRaiseHandState();
    const currentUser = useCurrentUser().user;

    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [isBackstage, setIsBackstage] = useState<boolean>(false);
    const [startTimeOfNextBackstage, setStartTimeOfNextBackstage] = useState<number | null>(null);
    const [raisedHandUserIds, setRaisedHandUserIds] = useState<string[] | null>(null);

    useEffect(() => {
        const unsubscribe = raiseHand.CurrentEventId.subscribe(setCurrentEventId);
        return () => {
            unsubscribe();
        };
    }, [raiseHand.CurrentEventId]);

    useEffect(() => {
        const unsubscribe = raiseHand.IsBackstage.subscribe(setIsBackstage);
        return () => {
            unsubscribe();
        };
    }, [raiseHand.IsBackstage]);

    useEffect(() => {
        const unsubscribe = raiseHand.StartTimeOfNextBackstage.subscribe(setStartTimeOfNextBackstage);
        return () => {
            unsubscribe();
        };
    }, [raiseHand.StartTimeOfNextBackstage]);

    useEffect(() => {
        const unobserve = currentEventId
            ? raiseHand.observe(currentEventId, (update) => {
                  if ("userIds" in update) {
                      setRaisedHandUserIds([...update.userIds.values()]);
                  }
              })
            : () => {
                  // Intentionally empty
              };

        return () => {
            unobserve();
        };
    }, [currentEventId, raiseHand]);

    useEffect(() => {
        setRaisedHandUserIds(null);
    }, []);

    const registrants = useRegistrants(
        raisedHandUserIds !== null
            ? raisedHandUserIds.map((user) => ({
                  user,
              }))
            : []
    );

    if (isBackstage) {
        // RAISE_HAND_TODO: If is chair/presenter (yes let's include presenters!), give control to admit people
        // RAISE_HAND_TODO: Else, just display the "you are already backstage"
        return (
            <>
                <Box>Controls for managing raised hands</Box>
                <RegistrantsList
                    searchedRegistrants={registrants as Registrant[]}
                    action={(registrantId) => {
                        const userId = registrants.find((x) => x.id === registrantId)?.userId;
                        if (currentEventId && userId) {
                            raiseHand.accept(currentEventId, userId);
                        }
                    }}
                    // RAISE_HAND_TODO: Clone this component and customise the `action` property to enable accept/reject logic
                />
            </>
        );
    } else if (currentEventId) {
        if (raisedHandUserIds === null) {
            return <Spinner label="Loading users who have raised hands" />;
        }

        return (
            <>
                {raisedHandUserIds.includes(currentUser.id) ? (
                    <>
                        <Box>Waiting to be admitted</Box>
                    </>
                ) : (
                    <>
                        {/* RAISE_HAND_TODO: Show recording consent*/}
                        <Box>Pre-join screen</Box>
                    </>
                )}

                <EventVonageRoom
                    eventId={currentEventId}
                    isRaiseHandPreJoin={true}
                    isRaiseHandWaiting={raisedHandUserIds.includes(currentUser.id)}
                />
                <RegistrantsList searchedRegistrants={registrants as Registrant[]} />
            </>
        );
    } else if (startTimeOfNextBackstage !== null) {
        // RAISE_HAND_TODO: Show message explaining time until next backstage is available
        return <>Time until next backstage</>;
    } else {
        // RAISE_HAND_TODO: Show message explaining no backstage is available for the current or next event
        return <>No backstage available</>;
    }
}