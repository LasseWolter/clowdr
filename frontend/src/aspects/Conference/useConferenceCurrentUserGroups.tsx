import { gql } from "@apollo/client";
import { Box, Spinner } from "@chakra-ui/react";
import assert from "assert";
import React from "react";
import {
    CurrentUserGroupsRolesPermissionsQuery,
    useCurrentUserGroupsRolesPermissionsQuery,
} from "../../generated/graphql";
import PageNotFound from "../Errors/PageNotFound";
import useMaybeCurrentUser from "../Users/CurrentUser/useMaybeCurrentUser";
import { useConference } from "./useConference";

gql`
    query CurrentUserGroupsRolesPermissions($userId: String, $conferenceId: uuid!) {
        User(where: { id: { _eq: $userId } }) {
            conferencesCreated(where: { id: { _eq: $conferenceId } }) {
                id
            }
            attendees(where: { conferenceId: { _eq: $conferenceId } }) {
                groupAttendees {
                    group {
                        groupRoles {
                            role {
                                rolePermissions {
                                    permissionName
                                    id
                                    roleId
                                }
                                id
                                name
                                conferenceId
                            }
                            id
                            roleId
                            groupId
                        }
                        enabled
                        id
                        includeUnauthenticated
                        name
                        conferenceId
                    }
                    id
                    groupId
                    attendeeId
                }
                id
                userId
                conferenceId
                displayName
            }
            id
        }
        publicGroups: Group(
            where: {
                conferenceId: { _eq: $conferenceId }
                enabled: { _eq: true }
                includeUnauthenticated: { _eq: true }
            }
        ) {
            groupRoles {
                role {
                    rolePermissions {
                        permissionName
                        id
                        roleId
                    }
                    id
                    name
                    conferenceId
                }
                id
                roleId
                groupId
            }
            enabled
            id
            includeUnauthenticated
            name
            conferenceId
        }
    }
`;

const CurrentUserGroupsRolesPermissionsContext = React.createContext<
    CurrentUserGroupsRolesPermissionsQuery | undefined
>(undefined);

export function useCurrentUserGroupsRolesPermissions(): CurrentUserGroupsRolesPermissionsQuery {
    const conf = React.useContext(CurrentUserGroupsRolesPermissionsContext);
    assert(conf);
    return conf;
}

export default function CurrentUserGroupsRolesPermissionsProvider({
    children,
}: {
    children: string | JSX.Element | JSX.Element[];
}): JSX.Element {
    const conference = useConference();
    const { user } = useMaybeCurrentUser();
    const { loading, error, data } = useCurrentUserGroupsRolesPermissionsQuery({
        fetchPolicy: "cache-and-network",
        variables: {
            conferenceId: conference.id,
            userId: user ? user.id : null,
        },
    });

    if (loading && !data) {
        return (
            <Box>
                <Spinner />
            </Box>
        );
    }

    if (error) {
        return <PageNotFound />;
    }

    if (
        !data ||
        data.User.length === 0 ||
        ((data.User[0].attendees.length === 0 ||
            data.User[0].attendees[0].groupAttendees.length === 0 ||
            data.User[0].attendees[0].groupAttendees[0].group.groupRoles.length === 0) &&
            data.User[0].conferencesCreated.length == 0)
    ) {
        return <PageNotFound />;
    }

    return (
        <CurrentUserGroupsRolesPermissionsContext.Provider value={data}>
            {children}
        </CurrentUserGroupsRolesPermissionsContext.Provider>
    );
}
