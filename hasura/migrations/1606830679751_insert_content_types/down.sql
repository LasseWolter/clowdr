DELETE FROM "ContentType"
  WHERE name = 'ABSTRACT'
  OR name = 'TEXT'
  OR name = 'VIDEO_FILE'
  OR name = 'VIDEO_URL'
  OR name = 'VIDEO_LINK'
  OR name = 'POSTER_FILE'
  OR name = 'POSTER_URL'
  OR name = 'IMAGE_FILE'
  OR name = 'IMAGE_URL'
  OR name = 'PAPER_FILE'
  OR name = 'PAPER_URL'
  OR name = 'PAPER_LINK'
  OR name = 'LINK'
  OR name = 'LINK_BUTTON';