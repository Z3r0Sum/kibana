/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiPanel,
  EuiSpacer,
  EuiConfirmModal,
  EuiInMemoryTable,
  EuiTitle,
  EuiText,
} from '@elastic/eui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Conversation } from '../../../assistant_context/types';
import { ConversationTableItem, useConversationsTable } from './use_conversations_table';
import { ConversationStreamingSwitch } from '../conversation_settings/conversation_streaming_switch';
import { AIConnector } from '../../../connectorland/connector_selector';
import * as i18n from './translations';

import {
  FetchConversationsResponse,
  useFetchCurrentUserConversations,
  useFetchPrompts,
} from '../../api';
import { useAssistantContext } from '../../../assistant_context';
import { useConversationDeleted } from '../conversation_settings/use_conversation_deleted';
import { useFlyoutModalVisibility } from '../../common/components/assistant_settings_management/flyout/use_flyout_modal_visibility';
import { Flyout } from '../../common/components/assistant_settings_management/flyout';
import { CANCEL, DELETE, SETTINGS_UPDATED_TOAST_TITLE } from '../../settings/translations';
import { ConversationSettingsEditor } from '../conversation_settings/conversation_settings_editor';
import { useConversationChanged } from '../conversation_settings/use_conversation_changed';
import { CONVERSATION_TABLE_SESSION_STORAGE_KEY } from '../../../assistant_context/constants';
import { useSessionPagination } from '../../common/components/assistant_settings_management/pagination/use_session_pagination';
import { DEFAULT_PAGE_SIZE } from '../../settings/const';
import { useSettingsUpdater } from '../../settings/use_settings_updater/use_settings_updater';
import { mergeBaseWithPersistedConversations } from '../../helpers';
import { AssistantSettingsBottomBar } from '../../settings/assistant_settings_bottom_bar';
interface Props {
  connectors: AIConnector[] | undefined;
  defaultConnector?: AIConnector;
  defaultSelectedConversation: Conversation;
  isDisabled?: boolean;
}

export const DEFAULT_TABLE_OPTIONS = {
  page: { size: DEFAULT_PAGE_SIZE, index: 0 },
  sort: { field: 'createdAt', direction: 'desc' as const },
};

const ConversationSettingsManagementComponent: React.FC<Props> = ({
  connectors,
  defaultConnector,
  defaultSelectedConversation,
  isDisabled,
}) => {
  const {
    actionTypeRegistry,
    assistantAvailability: { isAssistantEnabled },
    baseConversations,
    http,
    nameSpace,
    toasts,
  } = useAssistantContext();

  const onFetchedConversations = useCallback(
    (conversationsData: FetchConversationsResponse): Record<string, Conversation> =>
      mergeBaseWithPersistedConversations(baseConversations, conversationsData),
    [baseConversations]
  );

  const { data: allPrompts, isFetched: promptsLoaded, refetch: refetchPrompts } = useFetchPrompts();

  const {
    data: conversations,
    isFetched: conversationsLoaded,
    refetch: refetchConversations,
  } = useFetchCurrentUserConversations({
    http,
    onFetch: onFetchedConversations,
    isAssistantEnabled,
  });

  const refetchAll = useCallback(() => {
    refetchPrompts();
    refetchConversations();
  }, [refetchPrompts, refetchConversations]);

  const {
    systemPromptSettings: allSystemPrompts,
    assistantStreamingEnabled,
    conversationSettings,
    conversationsSettingsBulkActions,
    resetSettings,
    saveSettings,
    setConversationSettings,
    setConversationsSettingsBulkActions,
    setUpdatedAssistantStreamingEnabled,
  } = useSettingsUpdater(conversations, allPrompts, conversationsLoaded, promptsLoaded);

  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  const handleSave = useCallback(
    async (param?: { callback?: () => void }) => {
      const isSuccess = await saveSettings();
      if (isSuccess) {
        toasts?.addSuccess({
          iconType: 'check',
          title: SETTINGS_UPDATED_TOAST_TITLE,
        });
        setHasPendingChanges(false);
        param?.callback?.();
      } else {
        resetSettings();
      }
    },
    [resetSettings, saveSettings, toasts]
  );

  const setAssistantStreamingEnabled = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (value: any) => {
      setHasPendingChanges(true);
      setUpdatedAssistantStreamingEnabled(value);
    },
    [setUpdatedAssistantStreamingEnabled]
  );

  const onSaveButtonClicked = useCallback(() => {
    handleSave({ callback: refetchAll });
  }, [handleSave, refetchAll]);

  const onCancelClick = useCallback(() => {
    resetSettings();
    setHasPendingChanges(false);
  }, [resetSettings]);

  // Local state for saving previously selected items so tab switching is friendlier
  // Conversation Selection State
  const [selectedConversation, setSelectedConversation] = useState<Conversation | undefined>(() => {
    return conversationSettings[defaultSelectedConversation.title];
  });

  const onSelectedConversationChange = useCallback((conversation?: Conversation) => {
    setSelectedConversation(conversation);
  }, []);

  useEffect(() => {
    if (selectedConversation != null) {
      const newConversation =
        conversationSettings[selectedConversation.id] ||
        conversationSettings[selectedConversation.title];
      setSelectedConversation(
        // conversationSettings has title as key, sometime has id as key
        newConversation
      );
    }
  }, [conversationSettings, selectedConversation]);

  const {
    isFlyoutOpen: editFlyoutVisible,
    openFlyout: openEditFlyout,
    closeFlyout: closeEditFlyout,
  } = useFlyoutModalVisibility();
  const [deletedConversation, setDeletedConversation] = useState<ConversationTableItem | null>();

  const {
    isFlyoutOpen: deleteConfirmModalVisibility,
    openFlyout: openConfirmModal,
    closeFlyout: closeConfirmModal,
  } = useFlyoutModalVisibility();

  const onConversationSelectionChange = useConversationChanged({
    allSystemPrompts,
    conversationSettings,
    conversationsSettingsBulkActions,
    defaultConnector,
    setConversationSettings,
    setConversationsSettingsBulkActions,
    onSelectedConversationChange,
  });

  const onEditActionClicked = useCallback(
    (rowItem: ConversationTableItem) => {
      openEditFlyout();
      onConversationSelectionChange(rowItem);
    },
    [onConversationSelectionChange, openEditFlyout]
  );

  const onConversationDeleted = useConversationDeleted({
    conversationSettings,
    conversationsSettingsBulkActions,
    setConversationSettings,
    setConversationsSettingsBulkActions,
  });

  const onDeleteActionClicked = useCallback(
    (rowItem: ConversationTableItem) => {
      setDeletedConversation(rowItem);
      onConversationDeleted(rowItem.title);

      closeEditFlyout();
      openConfirmModal();
    },
    [closeEditFlyout, onConversationDeleted, openConfirmModal]
  );

  const onDeleteConfirmed = useCallback(() => {
    if (Object.keys(conversationsSettingsBulkActions).length === 0) {
      return;
    }
    closeConfirmModal();
    handleSave({ callback: refetchAll });
    setConversationsSettingsBulkActions({});
  }, [
    closeConfirmModal,
    conversationsSettingsBulkActions,
    handleSave,
    refetchAll,
    setConversationsSettingsBulkActions,
  ]);

  const onDeleteCancelled = useCallback(() => {
    setDeletedConversation(null);
    closeConfirmModal();
    onCancelClick();
  }, [closeConfirmModal, onCancelClick]);

  const { getConversationsList, getColumns } = useConversationsTable();

  const { onTableChange, pagination, sorting } = useSessionPagination({
    nameSpace,
    storageKey: CONVERSATION_TABLE_SESSION_STORAGE_KEY,
    defaultTableOptions: DEFAULT_TABLE_OPTIONS,
  });

  const conversationOptions = getConversationsList({
    allSystemPrompts,
    actionTypeRegistry,
    connectors,
    conversations: conversationSettings,
    defaultConnector,
  });

  const onSaveCancelled = useCallback(() => {
    closeEditFlyout();
    onCancelClick();
  }, [closeEditFlyout, onCancelClick]);

  const onSaveConfirmed = useCallback(() => {
    closeEditFlyout();
    handleSave({ callback: refetchAll });
    setConversationsSettingsBulkActions({});
  }, [closeEditFlyout, handleSave, refetchAll, setConversationsSettingsBulkActions]);

  const columns = useMemo(
    () =>
      getColumns({
        onDeleteActionClicked,
        onEditActionClicked,
      }),
    [getColumns, onDeleteActionClicked, onEditActionClicked]
  );

  const confirmationTitle = useMemo(
    () =>
      deletedConversation?.title
        ? i18n.DELETE_CONVERSATION_CONFIRMATION_TITLE(deletedConversation?.title)
        : i18n.DELETE_CONVERSATION_CONFIRMATION_DEFAULT_TITLE,
    [deletedConversation?.title]
  );

  if (!conversationsLoaded) {
    return null;
  }

  return (
    <>
      <EuiPanel hasShadow={false} hasBorder paddingSize="l">
        <EuiTitle size="xs">
          <h2>{i18n.CONVERSATIONS_SETTINGS_TITLE}</h2>
        </EuiTitle>
        <ConversationStreamingSwitch
          assistantStreamingEnabled={assistantStreamingEnabled}
          setAssistantStreamingEnabled={setAssistantStreamingEnabled}
          compressed={false}
        />
        <EuiSpacer size="l" />
        <EuiTitle size="xs">
          <h2>{i18n.CONVERSATIONS_LIST_TITLE}</h2>
        </EuiTitle>
        <EuiSpacer size="xs" />
        <EuiText size="m">{i18n.CONVERSATIONS_LIST_DESCRIPTION}</EuiText>
        <EuiSpacer size="s" />
        <EuiInMemoryTable
          items={conversationOptions}
          columns={columns}
          pagination={pagination}
          sorting={sorting}
          onTableChange={onTableChange}
        />
      </EuiPanel>
      {editFlyoutVisible && (
        <Flyout
          flyoutVisible={editFlyoutVisible}
          onClose={onSaveCancelled}
          onSaveConfirmed={onSaveConfirmed}
          onSaveCancelled={onSaveCancelled}
          title={selectedConversation?.title ?? i18n.CONVERSATIONS_FLYOUT_DEFAULT_TITLE}
          saveButtonDisabled={
            selectedConversation?.title == null || selectedConversation?.title === ''
          }
        >
          <ConversationSettingsEditor
            allSystemPrompts={allSystemPrompts}
            conversationSettings={conversationSettings}
            conversationsSettingsBulkActions={conversationsSettingsBulkActions}
            http={http}
            isDisabled={isDisabled}
            refetchConversations={refetchConversations}
            selectedConversation={selectedConversation}
            setConversationSettings={setConversationSettings}
            setConversationsSettingsBulkActions={setConversationsSettingsBulkActions}
            onSelectedConversationChange={onSelectedConversationChange}
          />
        </Flyout>
      )}
      {deleteConfirmModalVisibility && deletedConversation?.title && (
        <EuiConfirmModal
          aria-labelledby={confirmationTitle}
          title={confirmationTitle}
          titleProps={{ id: deletedConversation?.id ?? undefined }}
          onCancel={onDeleteCancelled}
          onConfirm={onDeleteConfirmed}
          cancelButtonText={CANCEL}
          confirmButtonText={DELETE}
          buttonColor="danger"
          defaultFocusedButton="confirm"
        >
          <p />
        </EuiConfirmModal>
      )}
      <AssistantSettingsBottomBar
        hasPendingChanges={hasPendingChanges}
        onCancelClick={onCancelClick}
        onSaveButtonClicked={onSaveButtonClicked}
      />
    </>
  );
};

export const ConversationSettingsManagement = React.memo(ConversationSettingsManagementComponent);

ConversationSettingsManagement.displayName = 'ConversationSettingsManagement';
