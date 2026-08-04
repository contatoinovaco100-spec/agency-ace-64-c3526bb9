# utils/post_scheduler.py
"""
Utility to post content in bulk with a configurable delay between posts.

Usage:

    from utils.post_scheduler import schedule_posts

    async def main():
        posts = [
            {"title": "Post 1", "body": "Hello"},
            {"title": "Post 2", "body": "World"},
            # …
        ]
        await schedule_posts(
            posts,
            post_func=api_client.create_post,   # async function that posts a single item
            interval=3600,                     # 1 hour in seconds
            logger=logger,                     # optional logger
        )

"""

import asyncio
import logging
from typing import Awaitable, Callable, Iterable, Any, Optional

# Type alias for a function that posts a single item
PostFunc = Callable[[Any], Awaitable[Any]]


async def schedule_posts(
    items: Iterable[Any],
    post_func: PostFunc,
    interval: float,
    logger: Optional[logging.Logger] = None,
) -> None:
    """
    Post each item in *items* using *post_func*, waiting *interval* seconds
    between each call.

    Parameters
    ----------
    items : Iterable[Any]
        Iterable of payloads to post.
    post_func : Callable[[Any], Awaitable[Any]]
        Async function that accepts a single payload and performs the post.
    interval : float
        Seconds to wait between posts.
    logger : logging.Logger, optional
        Logger used for progress and error reporting. If None, a default
        logger named ``post_scheduler`` is created.
    """
    if logger is None:
        logger = logging.getLogger("post_scheduler")
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                "%(asctime)s - %(levelname)s - %(message)s"
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(logging.INFO)

    items_list = list(items)
    total = len(items_list)
    for idx, item in enumerate(items_list, start=1):
        try:
            logger.info("Posting item %s/%s", idx, total)
            await post_func(item)
            logger.info("Posted item %s successfully", idx)
        except Exception as exc:
            logger.error("Error posting item %s: %s", idx, exc, exc_info=True)
        finally:
            if idx < total:
                logger.info("Sleeping for %.1f seconds before next post", interval)
                await asyncio.sleep(interval)
