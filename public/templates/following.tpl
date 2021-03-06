
<div class="well">
   


	<div class="account-username-box">
		<span class="account-username">
			<a href="/users/{userslug}">{username}</a> >
			<a href="/users/{userslug}/following">following</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="followersLink" class="pull-right"><a href="/users/{userslug}/followers">followers</a></span>
			<span id="followingLink" class="pull-right"><a href="/users/{userslug}/following">following</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{userslug}/edit">edit</a></span>
		</div>
	</div>

	<div>
		<!-- BEGIN following -->

		<div class="users-box well">
			<a href="/users/{following.userslug}">
				<img src="{following.picture}" class="user-8080-picture"/>
			</a>
			<br/>
			<a href="/users/{following.userslug}">{following.username}</a>
			<br/>
			<div title="reputation">
				<span class='reputation'>{following.reputation}</span>
				<i class='icon-star'></i>
			</div>
			<div title="post count">
				<span class='postcount'>{following.postcount}</span>
				<i class='icon-pencil'></i>
			</div>
			<a id="unfollow-btn" href="#" class="btn unfollow-btn" followingUid="{following.uid}">Unfollow</a>
		</div>

		<!-- END following -->
	</div>
	<div id="no-following-notice" class="alert alert-warning hide">This user isn't following anyone :(</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-variable="followingCount" value="{followingCount}" />

<script type="text/javascript" src="/src/forum/following.js"></script>
