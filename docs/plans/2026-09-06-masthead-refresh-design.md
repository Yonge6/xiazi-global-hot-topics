# Homepage masthead refresh

The masthead will move from a centered character-led banner to a restrained editorial frontispiece. GPT Image 2 provides the visual direction and the paper texture; all meaningful copy remains live HTML so dates, locales, accessibility, and future editions remain correct. The two cartoon characters are removed from this surface only. Brand characters remain available elsewhere in the product.

On desktop, a slim upper rail places “DAILY EDITION” at the left and the edition date at the right. Below it, the title occupies the larger left column while the daily count and manifesto sit in a narrower right column, separated by a fine vertical rule. A double lower rule, warm paper grain, vermilion punctuation, and generous negative space preserve the Chinese editorial character without making the header feel decorative or childish.

On mobile, the same hierarchy collapses naturally: the metadata rail remains horizontal, the title becomes one strong block, and the summary follows beneath a fine rule. No text is baked into the image, so Chinese and English use the same component and the visible publication copy can change independently from the real automation schedule.

Acceptance criteria: both locales render without overflow at desktop and phone widths; the page visibly says 07:00; `slotHour` and cron configuration remain unchanged; reduced-motion and dark-mode behavior continue to work; the generated background is compressed for production delivery.
