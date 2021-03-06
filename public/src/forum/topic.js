(function() {
	var	expose_tools = templates.get('expose_tools'),
		tid = templates.get('topic_id'),
		postListEl = document.getElementById('post-container'),
		editBtns = document.querySelectorAll('#post-container .post-buttons .edit, #post-container .post-buttons .edit i'),
		thread_state = {
			locked: templates.get('locked'),
			deleted: templates.get('deleted'),
			pinned: templates.get('pinned')
		},
		topic_name = templates.get('topic_name');

	function addCommasToNumbers() {
		$('.formatted-number').each(function(index, element) {
			$(element).html(app.addCommas($(element).html()));
		});
	}

	jQuery('document').ready(function() {

		addCommasToNumbers();
		
		var	room = 'topic_' + tid,
			adminTools = document.getElementById('thread-tools');

		app.enter_room(room);
		set_up_posts();

		if (thread_state.locked === '1') set_locked_state(true);
		if (thread_state.deleted === '1') set_delete_state(true);
		if (thread_state.pinned === '1') set_pinned_state(true);

		if (expose_tools === '1') {
			var deleteThreadEl = document.getElementById('delete_thread'),
				lockThreadEl = document.getElementById('lock_thread'),
				pinThreadEl = document.getElementById('pin_thread'),
				moveThreadEl = document.getElementById('move_thread'),
				moveThreadModal = $('#move_thread_modal');

			adminTools.style.visibility = 'inherit';

			// Add events to the thread tools
			deleteThreadEl.addEventListener('click', function(e) {
				e.preventDefault();
				if (thread_state.deleted !== '1') {
					bootbox.confirm('Are you sure you want to delete this thread?', function(confirm) {
						if (confirm) socket.emit('api:topic.delete', { tid: tid });
					});
				} else {
					bootbox.confirm('Are you sure you want to restore this thread?', function(confirm) {
						if (confirm) socket.emit('api:topic.restore', { tid: tid });
					});
				}
			}, false);

			lockThreadEl.addEventListener('click', function(e) {
				e.preventDefault();
				if (thread_state.locked !== '1') {
					socket.emit('api:topic.lock', { tid: tid });
				} else {
					socket.emit('api:topic.unlock', { tid: tid });
				}
			}, false);

			pinThreadEl.addEventListener('click', function(e) {
				e.preventDefault();
				if (thread_state.pinned !== '1') {
					socket.emit('api:topic.pin', { tid: tid });
				} else {
					socket.emit('api:topic.unpin', { tid: tid });
				}
			}, false);

			moveThreadEl.addEventListener('click', function(e) {
				e.preventDefault();
				moveThreadModal.modal('show');
			}, false);

			moveThreadModal.on('shown', function() {
				var loadingEl = document.getElementById('categories-loading');
				if (loadingEl) {
					socket.once('api:categories.get', function(data) {
						// Render categories
						var	categoriesFrag = document.createDocumentFragment(),
							categoryEl = document.createElement('li'),
							numCategories = data.categories.length,
							modalBody = moveThreadModal.find('.modal-body'),
							categoriesEl = modalBody[0].getElementsByTagName('ul')[0],
							confirmDiv = document.getElementById('move-confirm'),
							confirmCat = confirmDiv.getElementsByTagName('span')[0],
							commitEl = document.getElementById('move_thread_commit'),
							cancelEl = document.getElementById('move_thread_cancel'),
							x, info, targetCid, targetCatLabel;

						categoriesEl.className = 'category-list';
						for(x=0;x<numCategories;x++) {
							info = data.categories[x];
							categoryEl.className = info.blockclass;
							categoryEl.innerHTML = '<i class="' + info.icon + '"></i> ' + info.name;
							categoryEl.setAttribute('data-cid', info.cid);
							categoriesFrag.appendChild(categoryEl.cloneNode(true));
						}
						categoriesEl.appendChild(categoriesFrag);
						modalBody[0].removeChild(loadingEl);

						categoriesEl.addEventListener('click', function(e) {
							if (e.target.nodeName === 'LI') {
								confirmCat.innerHTML = e.target.innerHTML;
								confirmDiv.style.display = 'block';
								targetCid = e.target.getAttribute('data-cid');
								targetCatLabel = e.target.innerHTML;
								commitEl.disabled = false;
							}
						}, false);

						commitEl.addEventListener('click', function() {
							if (!commitEl.disabled && targetCid) {
								commitEl.disabled = true;
								$(cancelEl).fadeOut(250);
								$(moveThreadModal).find('.modal-header button').fadeOut(250);
								commitEl.innerHTML = 'Moving <i class="icon-spin icon-refresh"></i>';

								socket.once('api:topic.move', function(data) {
									moveThreadModal.modal('hide');
									if (data.status === 'ok') {
										app.alert({
											'alert_id': 'thread_move',
											type: 'success',
											title: 'Topic Successfully Moved',
											message: 'This topic has been successfully moved to ' + targetCatLabel,
											timeout: 5000
										});
									} else {
										app.alert({
											'alert_id': 'thread_move',
											type: 'error',
											title: 'Unable to Move Topic',
											message: 'This topic could not be moved to ' + targetCatLabel + '.<br />Please try again later',
											timeout: 5000
										});
									}
								});
								socket.emit('api:topic.move', { tid: tid, cid: targetCid });
							}
						});
					});
					socket.emit('api:categories.get');
				}
			});
		}

		// Fix delete state for this thread's posts
		var	postEls = document.querySelectorAll('#post-container li[data-deleted]');
		for(var x=0,numPosts=postEls.length;x<numPosts;x++) {
			if (postEls[x].getAttribute('data-deleted') === '1') toggle_post_delete_state(postEls[x].getAttribute('data-pid'));
			postEls[x].removeAttribute('data-deleted');
		}

		// Follow Thread State
		var followEl = $('.main-post .follow'),
			set_follow_state = function(state, quiet) {
				if (state && !followEl.hasClass('btn-success')) {
					followEl.addClass('btn-success');
					followEl[0].title = 'You are currently receiving updates to this topic';
					if (!quiet) {
						app.alert({
							alert_id: 'topic_follow',
							timeout: 2500,
							title: 'Following Topic',
							message: 'You will now be receiving notifications when somebody posts to this topic.',
							type: 'success'
						});
					}
				} else if (!state && followEl.hasClass('btn-success')) {
					followEl.removeClass('btn-success');
					followEl[0].title = 'Be notified of new replies in this topic';
					if (!quiet) {
						app.alert({
							alert_id: 'topic_follow',
							timeout: 2500,
							title: 'Not Following Topic',
							message: 'You will no longer receive notifications from this topic.',
							type: 'success'
						});
					}
				}
			};
		socket.on('api:topic.followCheck', function(state) {
			set_follow_state(state, true);
		});
		socket.on('api:topic.follow', function(data) {
			if (data.status && data.status === 'ok') set_follow_state(data.follow);
			else {
				app.alert({
					type: 'error',
					alert_id: 'topic_follow',
					title: 'Please Log In',
					message: 'Please register or log in in order to subscribe to this topic',
					timeout: 5000
				});
			}
		});
		socket.emit('api:topic.followCheck', tid);
		followEl[0].addEventListener('click', function() {
			socket.emit('api:topic.follow', tid);
		}, false);
	});


	$('.post-container').delegate('.edit', 'click', function(e) {
		var pid = ($(this).attr('id') || $(this.parentNode).attr('id')).split('_')[1];

		var main = $(this).parents('.main-post');
		// if(main.length > 0) 
		// 	app.open_post_window('edit', tid, topic_name, pid);
		// else 
		// 	app.open_post_window('edit', tid, "", pid);
		require(['composer'], function(cmp) {
			cmp.push(null, null, pid);
		});
	});

	$('.post-container').delegate('.delete', 'click', function(e) {
		var	pid = ($(this).attr('id') || $(this.parentNode).attr('id')).split('_')[1],
		postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
		deleteAction = !postEl.hasClass('deleted') ? true : false,
		confirmDel = confirm((deleteAction ? 'Delete' : 'Restore') + ' this post?');

		if (confirmDel) {
			deleteAction ?
			socket.emit('api:posts.delete', { pid: pid }) :
			socket.emit('api:posts.restore', { pid: pid });
		}
	}); 

	$('.post-container').delegate('.chat', 'click', function(e) {

		var username = $(this).parents('li').attr('data-username');
		var touid = $(this).parents('li').attr('data-uid');

		require(['chat'], function(chat){
			var chatModal = chat.createModalIfDoesntExist(username, touid);
			chatModal.show();
			chat.bringModalToTop(chatModal);
		});
		
	});

	socket.on('chatMessage', function(data) {
		
		var username = data.username;
		var fromuid = data.fromuid;
		var message = data.message;
		
		require(['chat'], function(chat) {
			var chatModal = chat.createModalIfDoesntExist(username, fromuid);
			chatModal.show();
			chat.bringModalToTop(chatModal);
	
			chat.appendChatMessage(chatModal, message);
		});
	});


	ajaxify.register_events([
		'event:rep_up', 'event:rep_down', 'event:new_post', 'api:get_users_in_room',
		'event:topic_deleted', 'event:topic_restored', 'event:topic:locked',
		'event:topic_unlocked', 'event:topic_pinned', 'event:topic_unpinned',
		'event:topic_moved', 'event:post_edited', 'event:post_deleted', 'event:post_restored',
		'api:posts.favourite', 'chatMessage'
	]);


	socket.on('api:get_users_in_room', function(users) {
		var anonymous = users.anonymous,
			usernames = users.usernames,
			userslugs = users.userslugs,
			usercount = usernames.length;

		for (var i = 0, ii=usercount; i<ii; i++) {
			usernames[i] = '<strong>' + '<a href="/users/'+userslugs[i]+'">' + usernames[i] + '</a></strong>';
		}

		// headexplosion.gif for fun, to see if I could do this in one line of code. feel free to refactor haha
		var active =
			((usercount === 1) ? usernames[0] : '')
			+ ((usercount === 2 && anonymous === 0) ? usernames[0] + ' and ' + usernames[1] : '')
			+ ((usercount > 2 && anonymous === 0) ? usernames.join(', ').replace(/,([^,]*)$/, ", and$1") : '')
			+ (usercount > 1 && anonymous > 0 ? usernames.join(', ') : '')
			+ ((anonymous > 0) ? (usercount > 0 ? ' and ': '') + anonymous + ' guest' + (anonymous > 1  ? 's are': ' is') : '')
			+ (anonymous === 0 ? (usercount > 1 ? ' are' : ' is') : '') + ' browsing this thread';

		document.getElementById('thread_active_users').innerHTML = active;
	});

	socket.on('event:rep_up', function(data) {
		adjust_rep(1, data.pid, data.uid);
	});

	socket.on('event:rep_down', function(data) {
		adjust_rep(-1, data.pid, data.uid);
	});

	socket.on('event:new_post', function(data) {
		data.posts[0].display_moderator_tools = 'none';
		var html = templates.prepare(templates['topic'].blocks['posts']).parse(data),
			uniqueid = new Date().getTime();
			
		jQuery('<div id="' + uniqueid + '"></div>')
			.appendTo("#post-container")
			.hide()
			.append(html)
			.fadeIn('slow');

		socket.once('api:post.privileges', function(privileges) {
			if (privileges.editable) toggle_mod_tools(data.posts[0].pid, true);
		});
		socket.emit('api:post.privileges', data.posts[0].pid);

		set_up_posts(uniqueid);
		
		addCommasToNumbers();
	});

	socket.on('event:topic_deleted', function(data) {
		if (data.tid === tid && data.status === 'ok') {
			set_locked_state(true);
			set_delete_state(true);
		}
	});

	socket.on('event:topic_restored', function(data) {
		if (data.tid === tid && data.status === 'ok') {
			set_locked_state(false);
			set_delete_state(false);
		}
	});

	socket.on('event:topic_locked', function(data) {
		if (data.tid === tid && data.status === 'ok') {
			set_locked_state(true, 1);
		}
	});

	socket.on('event:topic_unlocked', function(data) {
		if (data.tid === tid && data.status === 'ok') {
			set_locked_state(false, 1);
		}
	});

	socket.on('event:topic_pinned', function(data) {
		if (data.tid === tid && data.status === 'ok') {
			set_pinned_state(true, 1);
		}
	});

	socket.on('event:topic_unpinned', function(data) {
		if (data.tid === tid && data.status === 'ok') {
			set_pinned_state(false, 1);
		}
	});

	socket.on('event:topic_moved', function(data) {
		if (data && data.tid > 0) ajaxify.go('topic/' + data.tid);
	});

	socket.on('event:post_edited', function(data) {
		var editedPostEl = document.getElementById('content_' + data.pid);

		var editedPostTitle = $('#topic_title_'+data.pid);
		
		if(editedPostTitle.length > 0) {
			editedPostTitle.fadeOut(250, function() {
				editedPostTitle.html(data.title);
				editedPostTitle.fadeIn(250);
			});
		}

		$(editedPostEl).fadeOut(250, function() {
			this.innerHTML = data.content;
			$(this).fadeIn(250);
		});
	});

	socket.on('api:posts.favourite', function(data) {
		if (data.status !== 'ok' && data.pid) {
			var favEl = document.querySelector('.post_rep_' + data.pid).nextSibling;
			if (favEl) favEl.className = 'icon-star-empty';
		}
	});

	socket.on('event:post_deleted', function(data) {
		if (data.pid) toggle_post_delete_state(data.pid, true);
	});

	socket.on('event:post_restored', function(data) {
		if (data.pid) toggle_post_delete_state(data.pid, true);
	});

	function adjust_rep(value, pid, uid) {
		var post_rep = jQuery('.post_rep_' + pid),
			user_rep = jQuery('.user_rep_' + uid);

		var ptotal = parseInt(post_rep.html(), 10),
			utotal = parseInt(user_rep.html(), 10);

		ptotal += value;
		utotal += value;

		post_rep.html(ptotal);
		user_rep.html(utotal);
	}


	function set_up_posts(div) {
		if (div == null) div = '';
		else div = '#' + div;

		jQuery(div + ' .post_reply').click(function() {
			if (thread_state.locked !== '1') {
				require(['composer'], function(cmp) {
					cmp.push(tid);
				});
			}
		});

		jQuery(div + ' .quote').click(function() {
			if (thread_state.locked !== '1') {
				var pid = $(this).parents('li').attr('data-pid');

				socket.once('api:posts.getRawPost', function(data) {
					quoted = '> ' + data.post.replace(/\n/g, '\n> ') + '\n\n';
					require(['composer'], function(cmp) {
						cmp.push(tid, null, null, quoted);
					});
				});
				socket.emit('api:posts.getRawPost', { pid: pid });
					// $('.post-window textarea').val('> ' + $('#content_' + pid).html() + '\n');
				// });
			}
		});

		jQuery(div + ' .favourite').click(function() {
			var ids = this.id.replace('favs_', '').split('_'),
				pid = ids[0],
				uid = ids[1];

			if (thread_state.locked !== '1') {
				var element = $(this).find('i');
				if(element.attr('class') == 'icon-star-empty') {
					element.attr('class', 'icon-star');
					socket.emit('api:posts.favourite', {pid: pid, room_id: app.current_room});
				}
				else {
					element.attr('class', 'icon-star-empty');
					socket.emit('api:posts.unfavourite', {pid: pid, room_id: app.current_room});
				}
			}
		});
	}

	function set_locked_state(locked, alert) {
		var	threadReplyBtn = document.getElementById('post_reply'),
			postReplyBtns = document.querySelectorAll('#post-container .post_reply'),
			quoteBtns = document.querySelectorAll('#post-container .quote'),
			editBtns = document.querySelectorAll('#post-container .edit'),
			deleteBtns = document.querySelectorAll('#post-container .delete'),
			numPosts = document.querySelectorAll('#post_container li[data-pid]').length,
			lockThreadEl = document.getElementById('lock_thread'),
			x;

		if (locked === true) {
			lockThreadEl.innerHTML = '<i class="icon-unlock"></i> Unlock Thread';
			threadReplyBtn.disabled = true;
			threadReplyBtn.innerHTML = 'Locked <i class="icon-lock"></i>';
			for(x=0;x<numPosts;x++) {
				postReplyBtns[x].innerHTML = 'Locked <i class="icon-lock"></i>';
				quoteBtns[x].style.display = 'none';
				editBtns[x].style.display = 'none';
				deleteBtns[x].style.display = 'none';
			}

			if (alert) {
				app.alert({
					'alert_id': 'thread_lock',
					type: 'success',
					title: 'Thread Locked',
					message: 'Thread has been successfully locked',
					timeout: 5000
				});
			}

			thread_state.locked = '1';
		} else {
			lockThreadEl.innerHTML = '<i class="icon-lock"></i> Lock Thread';
			threadReplyBtn.disabled = false;
			threadReplyBtn.innerHTML = 'Reply';
			for(x=0;x<numPosts;x++) {
				postReplyBtns[x].innerHTML = 'Reply <i class="icon-reply"></i>';
				quoteBtns[x].style.display = 'inline-block';
				editBtns[x].style.display = 'inline-block';
				deleteBtns[x].style.display = 'inline-block';
			}

			if (alert) {
				app.alert({
					'alert_id': 'thread_lock',
					type: 'success',
					title: 'Thread Unlocked',
					message: 'Thread has been successfully unlocked',
					timeout: 5000
				});
			}

			thread_state.locked = '0';
		}
	}

	function set_delete_state(deleted) {
		var	deleteThreadEl = document.getElementById('delete_thread'),
			deleteTextEl = deleteThreadEl.getElementsByTagName('span')[0],
			threadEl = document.querySelector('.post-container'),
			deleteNotice = document.getElementById('thread-deleted') || document.createElement('div');

		if (deleted) {
			deleteTextEl.innerHTML = '<i class="icon-comment"></i> Restore Thread';
			$(threadEl).addClass('deleted');

			// Spawn a 'deleted' notice at the top of the page
			deleteNotice.setAttribute('id', 'thread-deleted');
			deleteNotice.className = 'alert';
			deleteNotice.innerHTML = 'This thread has been deleted. Only users with thread management privileges can see it.';
			document.getElementById('content').insertBefore(deleteNotice, threadEl);

			thread_state.deleted = '1';
		} else {
			deleteTextEl.innerHTML = '<i class="icon-trash"></i> Delete Thread';
			$(threadEl).removeClass('deleted');
			deleteNotice.parentNode.removeChild(deleteNotice);

			thread_state.deleted = '0';
		}
	}

	function set_pinned_state(pinned, alert) {
		var pinEl = document.getElementById('pin_thread');

		if (pinned) {
			pinEl.innerHTML = '<i class="icon-pushpin"></i> Unpin Thread';
			if (alert) {
				app.alert({
					'alert_id': 'thread_pin',
					type: 'success',
					title: 'Thread Pinned',
					message: 'Thread has been successfully pinned',
					timeout: 5000
				});
			}

			thread_state.pinned = '1';
		} else {
			pinEl.innerHTML = '<i class="icon-pushpin"></i> Pin Thread';
			if (alert) {
				app.alert({
					'alert_id': 'thread_pin',
					type: 'success',
					title: 'Thread Unpinned',
					message: 'Thread has been successfully unpinned',
					timeout: 5000
				});
			}

			thread_state.pinned = '0';
		}
	}

	function toggle_post_delete_state(pid) {
		var	postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]'));

		if (postEl[0]) {
			quoteEl = $(postEl[0].querySelector('.quote')),
			favEl = $(postEl[0].querySelector('.favourite')),
			replyEl = $(postEl[0].querySelector('.post_reply'));

			socket.once('api:post.privileges', function(privileges) {
				if (privileges.editable) {
					if (!postEl.hasClass('deleted')) {
						toggle_post_tools(pid, false);
					} else {
						toggle_post_tools(pid, true);
					}
				}

				if (privileges.view_deleted) {
					postEl.toggleClass('deleted');
				} else {
					postEl.toggleClass('none');
				}
			});
			socket.emit('api:post.privileges', pid);
		}
	}

	function toggle_post_tools(pid, state) {
		var	postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
			quoteEl = $(postEl[0].querySelector('.quote')),
			favEl = $(postEl[0].querySelector('.favourite')),
			replyEl = $(postEl[0].querySelector('.post_reply'));

		if (state) {
			quoteEl.removeClass('none');
			favEl.removeClass('none');
			replyEl.removeClass('none');
		} else {
			quoteEl.addClass('none');
			favEl.addClass('none');
			replyEl.addClass('none');
		}
	}

	function toggle_mod_tools(pid, state) {
		var	postEl = $(document.querySelector('#post-container li[data-pid="' + pid + '"]')),
			editEl = postEl.find('.edit'),
			deleteEl = postEl.find('.delete');
		
		if (state) {
			editEl.removeClass('none');
			deleteEl.removeClass('none');
		} else {
			editEl.addClass('none');
			deleteEl.addClass('none');
		}
	}
})();