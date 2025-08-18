import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useThemeContext } from "@/context/ThemeContext";
import { useAi } from "@/context/AiContext";
import { usePIP } from "../PIPService/PIPManager";
import IconLibrary from "@/misc/helpers/icons";
import CText from "../TextComp";
import { Share } from "react-native";
import * as Linking from "expo-linking";

interface QuickActionsProps {
  showInDashboard?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  showInDashboard = true,
}) => {
  const { isDarkMode } = useThemeContext();
  const { isSessionActive, startSession, stopSession } = useAi();
  const {
    isPIPActive,
    showPIP,
    hidePIP,
    hasOverlayPermission,
    requestPermission,
  } = usePIP();

  const handlePIPToggle = async () => {
    if (isPIPActive) {
      hidePIP();
      return;
    }

    // Check platform-specific requirements
    if (Platform.OS === "android" && !hasOverlayPermission) {
      Alert.alert(
        "Permission Required",
        "HeySolana needs overlay permission to display the floating AI assistant over other apps.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Grant Permission",
            onPress: async () => {
              await requestPermission();
            },
          },
        ]
      );
      return;
    }

    if (isSessionActive) {
      showPIP();
    } else {
      Alert.alert(
        "Start AI Session",
        Platform.OS === "android"
          ? "Would you like to start an AI session in floating mode? This will appear over other apps."
          : "Would you like to start an AI session in PIP mode?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start",
            onPress: () => {
              startSession();
              setTimeout(() => showPIP(), 1000);
            },
          },
        ]
      );
    }
  };

  const shareWidgetInstructions = async () => {
    const instructions = `🤖 HeySolana AI Widget Setup

For iOS Shortcuts:
1. Open Shortcuts app
2. Tap + to create new shortcut
3. Add "Open URL" action
4. Set URL to: heysolana://ai/start
5. Add to Home Screen as widget

For Android Widgets:
1. Long press home screen
2. Add widget → HeySolana
3. Select AI Quick Actions

Floating AI Assistant (Android):
• Requires overlay permission
• Works across all apps
• Drag to move, tap to interact

Deep Links Available:
• heysolana://ai/start - Start AI session
• heysolana://ai/stop - Stop AI session  
• heysolana://pip/show - Show floating AI
• heysolana://dashboard - Open dashboard`;

    try {
      await Share.share({
        message: instructions,
        title: "HeySolana Widget Setup Instructions",
      });
    } catch (error) {
      console.error("Error sharing instructions:", error);
      Alert.alert("Widget Setup Instructions", instructions, [{ text: "OK" }]);
    }
  };

  const getPIPStatus = () => {
    if (isPIPActive) {
      return {
        title: "Hide Floating AI",
        subtitle: "Exit floating mode",
        icon: "minimize",
        color: "#ff6b6b",
      };
    }

    if (Platform.OS === "android" && !hasOverlayPermission) {
      return {
        title: "Enable Floating AI",
        subtitle: "Grant overlay permission",
        icon: "warning",
        color: "#f39c12",
      };
    }

    return {
      title: "Show Floating AI",
      subtitle:
        Platform.OS === "android"
          ? "Float over other apps"
          : "Enable floating mode",
      icon: "maximize",
      color: "#4ecdc4",
    };
  };

  const pipStatus = getPIPStatus();

  const quickActions = [
    {
      id: "pip",
      ...pipStatus,
      onPress: handlePIPToggle,
    },
    {
      id: "widget_setup",
      title: "Widget Setup",
      subtitle: "Add AI widget to home screen",
      icon: "grid",
      onPress: shareWidgetInstructions,
      color: "#45b7d1",
    },
    {
      id: "shortcuts",
      title: "Quick Links",
      subtitle: "Copy app shortcuts",
      icon: "link",
      onPress: () => {
        Alert.alert("Quick Actions", "Choose an action to copy to clipboard:", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start AI",
            onPress: () => Linking.openURL("heysolana://ai/start"),
          },
          {
            text: "Show Floating AI",
            onPress: () => Linking.openURL("heysolana://pip/show"),
          },
        ]);
      },
      color: "#f7b731",
    },
  ];

  if (!showInDashboard) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDarkMode ? "#1a1a1a" : "#f8f9fa" },
      ]}
    >
      <View style={styles.header}>
        <IconLibrary.star color={isDarkMode ? "white" : "black"} size={20} />
        <CText
          style={[styles.headerText, { color: isDarkMode ? "white" : "black" }]}
        >
          Quick Actions
        </CText>
        {Platform.OS === "android" && (
          <View style={styles.permissionIndicator}>
            <View
              style={[
                styles.permissionDot,
                {
                  backgroundColor: hasOverlayPermission ? "#27ae60" : "#e74c3c",
                },
              ]}
            />
            <CText
              style={[
                styles.permissionText,
                { color: isDarkMode ? "#aaa" : "#666" },
              ]}
            >
              {hasOverlayPermission ? "Overlay OK" : "Need Permission"}
            </CText>
          </View>
        )}
      </View>

      <View style={styles.actionsContainer}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionButton,
              {
                backgroundColor: isDarkMode ? "#2a2a2a" : "white",
                borderColor: action.color,
              },
            ]}
            onPress={action.onPress}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${action.color}20` },
              ]}
            >
              <View
                style={[styles.iconCircle, { backgroundColor: action.color }]}
              >
                {action.icon === "minimize" && (
                  <IconLibrary.cancel color="white" size={16} />
                )}
                {action.icon === "maximize" && (
                  <IconLibrary.pluscircle color="white" size={16} />
                )}
                {action.icon === "warning" && (
                  <IconLibrary.info color="white" size={16} />
                )}
                {action.icon === "grid" && (
                  <IconLibrary.tools color="white" size={16} />
                )}
                {action.icon === "link" && (
                  <IconLibrary.external color="white" size={16} />
                )}
              </View>
            </View>

            <View style={styles.textContainer}>
              <CText
                style={[
                  styles.actionTitle,
                  { color: isDarkMode ? "white" : "black" },
                ]}
              >
                {action.title}
              </CText>
              <CText
                style={[
                  styles.actionSubtitle,
                  { color: isDarkMode ? "#aaa" : "#666" },
                ]}
              >
                {action.subtitle}
              </CText>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    marginHorizontal: 15,
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  headerText: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
    flex: 1,
  },
  permissionIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  permissionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  permissionText: {
    fontSize: 10,
    fontWeight: "500",
  },
  actionsContainer: {
    gap: 10,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  iconContainer: {
    marginRight: 12,
    borderRadius: 8,
    padding: 4,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
});

export default QuickActions; 