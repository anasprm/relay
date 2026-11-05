/** Smart thread briefs API. */

/** GET /api/conversations/:id/brief — returns a compact summary of the conversation for the viewer, using the deterministic extractive approach so no third-party AI keys are required. */

const router = Router();
router.use(requireAuth);

router.get('/:conversationId/brief', async (req, res, next) => {
  try {
    const conversation = findConversation(req.params.conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

    const viewerId = req.user.id;
    if (!conversation.participantIds.includes(viewerId)) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    const dbMessages = [...db.messages].filter(
      (m) => m.conversationId === conversation.id,
    );

    const brief = buildBrief({
      conversation,
      viewerId,
      messages: dbMessages,
    });

    res.json({ brief });
  } catch (error) {
    next(error);
  }
});

export default router;