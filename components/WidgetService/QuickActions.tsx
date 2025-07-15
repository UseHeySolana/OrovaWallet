import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useThemeContext } from '@/misc/context/ThemeContext';
import { useAi } from '@/misc/context/AiContext';
import { usePIP } from '../PIPService/PIPManager';
import IconLibrary from '@/misc/helpers/icons';
import CText from '../TextComp';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';

interface QuickActionsProps {
  showInDashboard?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({ showInDashboard = true }) => {
  const { isDarkMode } = useThemeContext();
  const { isSessionActive, startSession, stopSession } = useAi();
  const { isPIPActive, showPIP, hidePIP } = usePIP();

  const handlePIPToggle = () => {
    if (isPIPActive) {
      hidePIP();
    } else {
      if (isSessionActive) {
        showPIP();
      } else {
        Alert.alert(
          'Start AI Session',
          'Would you like to start an AI session in PIP mode?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Start', 
              onPress: () => {
                startSession();
                setTimeout(() => showPIP(), 1000);
              }
            },
          ]
        );
      }
    }
  };

  const shareWidgetInstructions = async () => {
    const instructions = `
🤖 HeySolana AI Widget Setup

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

Deep Links Available:
• heysolana://ai/start - Start AI session
• heysolana://ai/stop - Stop AI session  
• heysolana://pip/show - Show PIP mode
• heysolana://dashboard - Open dashboard
    `;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(instructions, {
          mimeType: 'text/plain',
          dialogTitle: 'HeySolana Widget Setup Instructions',
        });
      } else {
        Alert.alert(
          'Widget Setup Instructions',
          instructions,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing instructions:', error);
    }
  };

  const quickActions = [
    {
      id: 'pip',
      title: isPIPActive ? 'Hide PIP' : 'Show PIP',
      subtitle: isPIPActive ? 'Exit floating mode' : 'Enable floating AI',
      icon: isPIPActive ? 'minimize' : 'maximize',
      onPress: handlePIPToggle,
      color: isPIPActive ? '#ff6b6b' : '#4ecdc4',
    },
    {
      id: 'widget_setup',
      title: 'Widget Setup',
      subtitle: 'Add AI widget to home screen',
      icon: 'grid',
      onPress: shareWidgetInstructions,
      color: '#45b7d1',
    },
    {
      id: 'shortcuts',
      title: 'Quick Links',
      subtitle: 'Copy app shortcuts',
      icon: 'link',
      onPress: () => {
        Alert.alert(
          'Quick Actions',
          'Choose an action to copy to clipboard:',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Start AI', 
              onPress: () => Linking.openURL('heysolana://ai/start')
            },
            { 
              text: 'Show PIP', 
              onPress: () => Linking.openURL('heysolana://pip/show')
            },
          ]
        );
      },
      color: '#f7b731',
    },
  ];

  if (!showInDashboard) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDarkMode ? '#1a1a1a' : '#f8f9fa' }
    ]}>
      <View style={styles.header}>
                 <IconLibrary.star color={isDarkMode ? 'white' : 'black'} size={20} />
        <CText style={[
          styles.headerText,
          { color: isDarkMode ? 'white' : 'black' }
        ]}>
          Quick Actions
        </CText>
      </View>
      
      <View style={styles.actionsContainer}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionButton,
              { 
                backgroundColor: isDarkMode ? '#2a2a2a' : 'white',
                borderColor: action.color,
              }
            ]}
            onPress={action.onPress}
          >
            <View style={[
              styles.iconContainer,
              { backgroundColor: `${action.color}20` }
            ]}>
              <View style={[
                styles.iconCircle,
                { backgroundColor: action.color }
              ]}>
                                 {action.icon === 'minimize' && <IconLibrary.cancel color="white" size={16} />}
                 {action.icon === 'maximize' && <IconLibrary.pluscircle color="white" size={16} />}
                 {action.icon === 'grid' && <IconLibrary.tools color="white" size={16} />}
                 {action.icon === 'link' && <IconLibrary.external color="white" size={16} />}
              </View>
            </View>
            
            <View style={styles.textContainer}>
              <CText style={[
                styles.actionTitle,
                { color: isDarkMode ? 'white' : 'black' }
              ]}>
                {action.title}
              </CText>
              <CText style={[
                styles.actionSubtitle,
                { color: isDarkMode ? '#aaa' : '#666' }
              ]}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionsContainer: {
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    opacity: 0.8,
  },
});

export default QuickActions; 