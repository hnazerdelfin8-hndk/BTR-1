export const config = {
  name: 'BTR 1',
  fullName: 'BTR 1 Personal AI Assistant',
  version: '1.0.2',
  userTitle: 'Master',
  api: {
    chat: '/api/chat',
    tools: '/api/tools'
  },
  voice: {
    enabled: true,
    wakeWords: ['hey btr', 'yo btr', 'btr']
  }
};
